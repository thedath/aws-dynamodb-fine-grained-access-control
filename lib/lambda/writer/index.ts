import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import toDynamoDBInputItems from "../../utils/toDynamoDBInputItems";

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  console.log(`Context: ${JSON.stringify(context, null, 2)}`);

  try {
    const assumedRoleARN = process.env.TABLE_WRITE_ASSUMED_ROLE!;
    const tableARN = process.env.TABLE_ARN!;

    const {
      auth: { o_id, u_id, entity },
      ...rest
    } = JSON.parse(event.body!);

    const Policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["dynamodb:PutItem"],
          Resource: [tableARN],
          Condition: {
            "ForAllValues:StringLike": {
              "dynamodb:LeadingKeys": [
                entity === "note"
                  ? "org/${aws:PrincipalTag/o_id}/user/${aws:PrincipalTag/u_id}/note"
                  : false,
                entity === "product"
                  ? "org/${aws:PrincipalTag/o_id}/user/${aws:PrincipalTag/u_id}/product"
                  : false,
              ].filter((val) => !!val),
            },
            "ForAllValues:StringEquals": {
              "dynamodb:Attributes": [
                "OrgPartK1",
                "OrgSortK1",
                ...(entity === "note" ? ["n_content", "n_type"] : []),
                ...(entity === "product" ? ["p_name", "p_price"] : []),
              ],
            },
          },
        },
      ],
    });

    console.log("Policy: ", Policy);

    const sts = new STSClient({});
    const session = await sts.send(
      new AssumeRoleCommand({
        RoleArn: assumedRoleARN,
        RoleSessionName: "TableWriterSession",
        DurationSeconds: 900,
        Tags: [
          {
            Key: "o_id",
            Value: o_id,
          },
          {
            Key: "u_id",
            Value: u_id,
          },
        ],
        Policy,
      })
    );

    const dynamoDb = new DynamoDBClient({
      credentials: {
        accessKeyId: session.Credentials?.AccessKeyId!,
        secretAccessKey: session.Credentials?.SecretAccessKey!,
        sessionToken: session.Credentials?.SessionToken,
      },
    });

    const result = await dynamoDb.send(
      new PutItemCommand({
        TableName: "OrgTable",
        Item: { ...toDynamoDBInputItems(rest) },
      })
    );

    return { statusCode: 200, body: JSON.stringify({ ...result }) };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 403,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
};
