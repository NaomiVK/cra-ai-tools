# Lambda@Edge must be deployed in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# IAM role for Lambda@Edge
resource "aws_iam_role" "lambda_edge" {
  name = "cra-ai-tools-lambda-edge-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_edge_basic" {
  role       = aws_iam_role.lambda_edge.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Package the auth function
data "archive_file" "auth" {
  type        = "zip"
  output_path = "${path.module}/auth.zip"

  source {
    content = templatefile("${path.module}/auth.js.tpl", {
      credentials = base64encode("${var.auth_username}:${var.auth_password}")
    })
    filename = "index.js"
  }
}

# Lambda@Edge function for basic auth
resource "aws_lambda_function" "auth" {
  provider = aws.us_east_1

  filename         = data.archive_file.auth.output_path
  source_code_hash = data.archive_file.auth.output_base64sha256
  function_name    = "cra-ai-tools-auth-${var.environment}"
  role             = aws_iam_role.lambda_edge.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  publish          = true

  tags = {
    Environment = var.environment
    Project     = "cra-ai-tools"
  }
}
