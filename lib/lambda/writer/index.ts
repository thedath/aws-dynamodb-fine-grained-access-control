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
      Effect: "ALLOW",
      Action: ["dynamodb:PutItem"],
      Resource: [tableARN],
      Condition: {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "OrgPartK1",
            "OrgSortK1",
            ...[entity === "note" && ["n_content", "n_type"]],
            ...[entity === "product" && ["p_id", "p_name"]],
          ].filter((attr) => !!attr),
        },
      },
    });

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
