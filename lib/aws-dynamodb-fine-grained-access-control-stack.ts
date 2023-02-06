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
  private readonly table: dynamodb.Table;
  private readonly api: apiGateway.RestApi;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // table configuration
    this.table = new dynamodb.Table(this, "OrgTable", {
      tableName: "OrgTable",
      partitionKey: {
        name: "TablePartKey",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "TableSortKey", type: dynamodb.AttributeType.STRING },
    });
    this.table.addGlobalSecondaryIndex({
      indexName: "Index1",
      partitionKey: {
        name: "Index1PartKey",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "Index1SortKey", type: dynamodb.AttributeType.STRING },
    });
    this.table.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // API configurations
    this.api = new apiGateway.RestApi(this, `OrgAPI`, {
      restApiName: `OrgAPI`,
    });

    // write lambda configuration
    const productCreateTablePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["dynamodb:PutItem"],
      resources: [this.table.tableArn],
      conditions: {
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": [
            "org/${aws:PrincipalTag/org_id}/role/${aws:PrincipalTag/user_role}/user/${aws:PrincipalTag/user_id}/product/*",
          ],
        },
      },
    });
    const productCreateIndexPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["dynamodb:PutItem"],
      resources: [`${this.table.tableArn}/index/Index1`],
      conditions: {
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": [
            "org/${aws:PrincipalTag/org_id}/role/${aws:PrincipalTag/user_role}/product",
          ],
        },
      },
    });
    const productCreateLambda = new RoleAssumingLambda(
      this,
      "ProductCreateLambda",
      {
        functionName: "ProductCreateLambda",
        runtime: lambda.Runtime.NODEJS_14_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("lib/lambda/product/create"),
        assumedRolePolicyStatements: [
          productCreateTablePolicy,
          productCreateIndexPolicy,
        ],
        assumedRoleArnEnvKey: "ASSUMED_ROLE",
        sessionTags: ["org_id", "user_role", "user_id"],
      }
    );
    productCreateLambda.addEnvironment("TABLE_ARN", this.table.tableArn);
    productCreateLambda.addEnvironment(
      "READER_INDEX_ARN",
      `${this.table.tableArn}/index/OrgTableReaderIndex`
    );

    this.api.root.addResource("product");
    this.api.root
      .getResource("product")
      ?.addMethod(
        "POST",
        new apiGateway.LambdaIntegration(productCreateLambda)
      );

    // read lambda configuration
    // const readPolicy = new iam.PolicyStatement({
    //   effect: iam.Effect.ALLOW,
    //   actions: ["dynamodb:Query"],
    //   resources: [table.tableArn],
    //   conditions: {
    //     "ForAllValues:StringLike": {
    //       "dynamodb:LeadingKeys": [
    //         "org/${aws:PrincipalTag/o_id}/user/${aws:PrincipalTag/u_id}/product",
    //         "org/${aws:PrincipalTag/o_id}/user/${aws:PrincipalTag/u_id}/note",
    //       ],
    //     },
    //     "ForAllValues:StringEquals": {
    //       "dynamodb:Attributes": [
    //         "${aws:PrincipalTag/PK}",
    //         "${aws:PrincipalTag/SK}",
    //         "${aws:PrincipalTag/Attribute_1}",
    //         "${aws:PrincipalTag/Attribute_2}",
    //         "${aws:PrincipalTag/Attribute_3}",
    //         "${aws:PrincipalTag/Attribute_4}",
    //         "${aws:PrincipalTag/Attribute_5}",
    //         "${aws:PrincipalTag/Attribute_6}",
    //         "p_id",
    //         "p_name",
    //         "p_price",
    //         "n_id",
    //         "n_content",
    //         "n_type",
    //       ],
    //     },
    //   },
    // });
    // const readLambda = new RoleAssumingLambda(this, "TableReadingLambda", {
    //   functionName: "TableReadingLambda",
    //   runtime: lambda.Runtime.NODEJS_14_X,
    //   handler: "index.handler",
    //   code: lambda.Code.fromAsset("lib/lambda/reader"),
    //   assumedRolePolicyStatements: [readPolicy],
    //   assumedRoleArnEnvKey: "TABLE_READ_ASSUMED_ROLE",
    //   sessionTags: ["o_id", "u_id"],
    // });
    // readLambda.addEnvironment("TABLE_ARN", table.tableArn);

    // api.root.addResource("write");
    // api.root
    //   .getResource("write")
    //   ?.addMethod("POST", new apiGateway.LambdaIntegration(writeLambda));
    // api.root.addResource("read");
    // api.root
    //   .getResource("read")
    //   ?.addMethod("POST", new apiGateway.LambdaIntegration(readLambda));
  }
}
