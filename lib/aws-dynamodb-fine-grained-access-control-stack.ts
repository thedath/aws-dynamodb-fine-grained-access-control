import {
  aws_apigateway as apiGateway,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
  RemovalPolicy,
  Stack,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import RoleAssumingLambda from "./RoleAssumingLambda";

const permissions = {
  product: {
    partitionKey: "PartKey1",
    sortKey: "SortKey1",
    creators: ["owner", "manager"],
    removers: ["owner"],
    updaters: {
      owner: ["name", "buying_price", "selling_price"],
      manager: ["name"],
    },
    readers: {
      owner: ["name", "buying_price", "selling_price"],
      manager: ["name", "buying_price", "selling_price"],
      customer: ["name", "selling_price"],
    },
  },
  feedback: {
    partitionKey: "PartKey2",
    sortKey: "SortKey2",
    creators: ["customer"],
    removers: [""],
    updaters: {
      owner: ["reviewed"],
      manager: ["reviewed"],
      customer: ["content"],
    },
    readers: {
      owner: ["content", "reviewed"],
      manager: ["content", "reviewed"],
      customer: ["content", "reviewed"],
    },
  },
};

export class AwsDynamodbFineGrainedAccessControlStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // table configuration
    const table = new dynamodb.Table(this, "OrgTable", {
      tableName: "OrgTable",
      partitionKey: { name: "OrgPartK1", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "OrgSortK1", type: dynamodb.AttributeType.STRING },
    });
    table.addGlobalSecondaryIndex({
      indexName: "OrgTableIndex",
      partitionKey: { name: "OrgPartK12", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "OrgSortK2", type: dynamodb.AttributeType.STRING },
    });
    table.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // write lambda configuration
    const writePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["dynamodb:PutItem"],
      resources: [table.tableArn],
      conditions: {
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": [
            "org/${aws:PrincipalTag/o_id}/user/${aws:PrincipalTag/u_id}/product",
            "org/${aws:PrincipalTag/o_id}/user/${aws:PrincipalTag/u_id}/note",
          ],
        },
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "OrgPartK1",
            "OrgSortK1",
            "p_id",
            "p_name",
            "p_price",
            "n_id",
            "n_content",
            "n_type",
          ],
        },
      },
    });
    const writeLambda = new RoleAssumingLambda(this, "TableWritingLambda", {
      functionName: "TableWritingLambda",
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lib/lambda/writer"),
      assumedRolePolicyStatements: [writePolicy],
      assumedRoleArnEnvKey: "TABLE_WRITE_ASSUMED_ROLE",
      sessionTags: ["o_id", "u_id"],
    });
    writeLambda.addEnvironment("TABLE_ARN", table.tableArn);

    // read lambda configuration
    const readPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["dynamodb:Query"],
      resources: [table.tableArn],
      conditions: {
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": [
            "org/${aws:PrincipalTag/o_id}/user/${aws:PrincipalTag/u_id}/product",
            "org/${aws:PrincipalTag/o_id}/user/${aws:PrincipalTag/u_id}/note",
          ],
        },
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "${aws:PrincipalTag/PK}",
            "${aws:PrincipalTag/SK}",
            "${aws:PrincipalTag/Attribute_1}",
            "${aws:PrincipalTag/Attribute_2}",
            "${aws:PrincipalTag/Attribute_3}",
            "${aws:PrincipalTag/Attribute_4}",
            "${aws:PrincipalTag/Attribute_5}",
            "${aws:PrincipalTag/Attribute_6}",
            "p_id",
            "p_name",
            "p_price",
            "n_id",
            "n_content",
            "n_type",
          ],
        },
      },
    });
    const readLambda = new RoleAssumingLambda(this, "TableReadingLambda", {
      functionName: "TableReadingLambda",
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lib/lambda/reader"),
      assumedRolePolicyStatements: [readPolicy],
      assumedRoleArnEnvKey: "TABLE_READ_ASSUMED_ROLE",
      sessionTags: ["o_id", "u_id"],
    });
    readLambda.addEnvironment("TABLE_ARN", table.tableArn);

    // API configurations
    const api = new apiGateway.RestApi(this, `${this.stackName}API`, {
      restApiName: `${this.stackName}API`,
    });
    api.root.addResource("write");
    api.root
      .getResource("write")
      ?.addMethod("POST", new apiGateway.LambdaIntegration(writeLambda));
    api.root.addResource("read");
    api.root
      .getResource("read")
      ?.addMethod("POST", new apiGateway.LambdaIntegration(readLambda));
  }
}
