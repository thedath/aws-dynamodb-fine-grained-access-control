import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  console.log(`Context: ${JSON.stringify(context, null, 2)}`);

  try {
    const assumedRoleARN = process.env.TABLE_READ_ASSUMED_ROLE!;
    const tableARN = process.env.TABLE_ARN!;

    const {
      auth: { o_id, u_id, entity },
      OrgPartK1,
      OrgSortK1,
      projectionString,
    } = JSON.parse(event.body!);

    const Policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["dynamodb:Query"],
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
                "${aws:PrincipalTag/PK}",
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
        RoleSessionName: "TableReadSession",
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
          {
            Key: "PK",
            Value: "OrgPartK1",
          },
          {
            Key: "SK",
            Value: "OrgSortK1",
          },
        ],
        // Policy,
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
      new QueryCommand({
        TableName: "OrgTable",
        KeyConditionExpression: "#PK1 = :PK1V and #SK1 = :SK1V",
        ExpressionAttributeNames: {
          "#PK1": "OrgPartK1",
          "#SK1": "OrgSortK1",
        },
        ExpressionAttributeValues: {
          ":PK1V": {
            S: OrgPartK1,
          },
          ":SK1V": {
            S: OrgSortK1,
          },
        },
        ProjectionExpression: projectionString,
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
