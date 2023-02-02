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

    // // table configuration
    // const table = new dynamodb.Table(this, "OrgTable", {
    //   tableName: "OrgTable",
    //   partitionKey: { name: "OrgPartK1", type: dynamodb.AttributeType.STRING },
    //   sortKey: { name: "OrgSortK1", type: dynamodb.AttributeType.STRING },
    // });
    // table.addGlobalSecondaryIndex({
    //   indexName: "OrgTableIndex",
    //   partitionKey: { name: "OrgPartK12", type: dynamodb.AttributeType.STRING },
    //   sortKey: { name: "OrgSortK2", type: dynamodb.AttributeType.STRING },
    // });
    // table.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // // read lambda configuration
    // const readPolicy = new iam.PolicyStatement({
    //   effect: iam.Effect.ALLOW,
    //   actions: ["dynamodb:Query"],
    //   resources: [table.tableArn],
    //   conditions: {
    //     "ForAllValues:StringLike": {
    //       "dynamodb:LeadingKeys": ["${aws:PrincipalTag/OrgPartK1}/*"],
    //     },
    //     "ForAllValues:StringEquals": {
    //       "dynamodb:Attributes": ["OrgPartK1", "OrgSortK1"],
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
    //   sessionTags: ["OrgPartK1", "OrgPartK2"],
    // });

    // // write lambda configuration
    // const writePolicy = new iam.PolicyStatement({
    //   effect: iam.Effect.ALLOW,
    //   actions: ["dynamodb:PutItem"],
    //   resources: [table.tableArn],
    //   conditions: {
    //     "ForAllValues:StringLike": {
    //       "dynamodb:LeadingKeys": [
    //         "${aws:PrincipalTag/OrgPartK1}",
    //         "${aws:PrincipalTag/OrgPartK1}/*",
    //         "${aws:PrincipalTag/OrgPartK1}/*/alpha",
    //       ],
    //     },
    //     "ForAllValues:StringEquals": {
    //       "dynamodb:Attributes": ["TenantId", "Email", "UserName", "UserHobby"],
    //     },
    //   },
    // });
    // const writeLambda = new RoleAssumingLambda(this, "TableWritingLambda", {
    //   functionName: "TableWritingLambda",
    //   runtime: lambda.Runtime.NODEJS_14_X,
    //   handler: "index.handler",
    //   code: lambda.Code.fromAsset("lib/lambda/writer"),
    //   assumedRolePolicyStatements: [writePolicy],
    //   assumedRoleArnEnvKey: "TABLE_WRITE_ASSUMED_ROLE",
    //   sessionTags: ["asd"],
    // });

    // // API configurations
    // const api = new apiGateway.RestApi(this, `${this.stackName}API`, {
    //   restApiName: `${this.stackName}API`,
    // });
    // api.root.addResource("read");
    // api.root
    //   .getResource("read")
    //   ?.addMethod("POST", new apiGateway.LambdaIntegration(readLambda));
    // api.root.addResource("write");
    // api.root
    //   .getResource("write")
    //   ?.addMethod("POST", new apiGateway.LambdaIntegration(writeLambda));

    // EXPERIMENT

    const root = new apiGateway.RestApi(this, `EsBuildTestAPI`, {
      restApiName: `EsBuildTestAPI`,
    }).root;

    root.addResource("esbuild");
    root.getResource("esbuild")?.addResource("alpha");
    root.getResource("esbuild")?.addResource("beta");
    root.getResource("esbuild")?.addResource("gamma");
    root.getResource("esbuild")?.addResource("theta");

    root
      .getResource("esbuild")
      ?.getResource("alpha")
      ?.addMethod(
        "GET",
        new apiGateway.LambdaIntegration(
          new lambda.Function(this, "EsBuildAlphaLambda", {
            functionName: "EsBuildAlphaLambda",
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "notIndex.handler",
            code: lambda.Code.fromAsset("lib/lambda/esbuild-tester/alpha"),
          })
        )
      );

    root
      .getResource("esbuild")
      ?.getResource("beta")
      ?.addMethod(
        "GET",
        new apiGateway.LambdaIntegration(
          new lambda.Function(this, "EsBuildBetaLambda", {
            functionName: "EsBuildBetaLambda",
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset("lib/lambda/esbuild-tester/beta"),
          })
        )
      );

    root
      .getResource("esbuild")
      ?.getResource("gamma")
      ?.addMethod(
        "GET",
        new apiGateway.LambdaIntegration(
          new lambda.Function(this, "EsBuildGammaLambda", {
            functionName: "EsBuildGammaLambda",
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset("lib/lambda/esbuild-tester/gamma"),
          })
        )
      );

    root
      .getResource("esbuild")
      ?.getResource("theta")
      ?.addMethod(
        "GET",
        new apiGateway.LambdaIntegration(
          new lambda.Function(this, "EsBuildThetaLambda", {
            functionName: "EsBuildThetaLambda",
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset("lib/lambda/esbuild-tester/theta"),
          })
        )
      );
  }
}
