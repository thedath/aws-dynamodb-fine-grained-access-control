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
            "p_name",
            "p_price",
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
          "dynamodb:LeadingKeys": ["${aws:PrincipalTag/OrgPartK1}/*"],
        },
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": ["OrgPartK1", "OrgSortK1"],
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
      sessionTags: ["OrgPartK1", "OrgPartK2"],
    });

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
