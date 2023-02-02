#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsDynamodbFineGrainedAccessControlStack } from "../lib/aws-dynamodb-fine-grained-access-control-stack";

const app = new cdk.App();
new AwsDynamodbFineGrainedAccessControlStack(
  app,
  "AwsDynamodbFineGrainedAccessControlStack"
);
