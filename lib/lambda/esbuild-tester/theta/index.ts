import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";

import * as _ from "lodash";
import { v4 } from "uuid";

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    new S3Client({});
    new DynamoDBClient({});
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "I'm theta",
        lodash: _.toPath("e.s.b.u.i.l.d"),
        uuidV4: v4(),
      }),
    };
  } catch (error) {
    return { statusCode: 403, body: (error as Error).message };
  }
};
