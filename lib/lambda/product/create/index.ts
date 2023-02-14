import {
  DynamoDBClient,
  PutItemCommand,
  TagResourceCommand,
} from "@aws-sdk/client-dynamodb";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { Policy } from "@aws-sdk/client-iam";
import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import toDynamoDBInputItems from "../../../utils/toDynamoDBInputItems";
import permissions from "../../permissions";

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  console.log(`Context: ${JSON.stringify(context, null, 2)}`);

  try {
    const assumedRoleARN = process.env.ASSUMED_ROLE!;
    const tableARN = process.env.TABLE_ARN!;
    const readerIndexARN = process.env.READER_INDEX_ARN!;

    const {
      auth: { org_id, user_role, user_id },
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
            "ForAllValues:StringEquals": {
              "dynamodb:Select": "SPECIFIC_ATTRIBUTES",
              "dynamodb:Attributes": [
                ...permissions.product.creators[
                  user_role as "owner" | "manager"
                ],
              ],
            },
          },
        },
        // {
        //   Effect: "Allow",
        //   Action: ["dynamodb:PutItem"],
        //   Resource: [readerIndexARN],
        //   Condition: {
        //     "ForAllValues:StringEquals": {
        //       "dynamodb:Select": "SPECIFIC_ATTRIBUTES",
        //       "dynamodb:Attributes": [
        //         permissions.product.readIndex.partKey,
        //         permissions.product.readIndex.sortKey,
        //         ...permissions.product.creators[
        //           user_role as "owner" | "manager"
        //         ],
        //       ],
        //     },
        //   },
        // },
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
          { Key: "org_id", Value: org_id },
          { Key: "user_role", Value: user_role },
          { Key: "user_id", Value: user_id },
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
