# alb-path-based-routing-practice

## OverView
ALBに来たリクエストをパスベースで別々のインスタンスへルーティングする構成(習作)

## Environment
```shell
❯ aws --version
aws-cli/2.13.32 Python/3.11.6 Darwin/23.2.0 exe/x86_64 prompt/off

❯ node --version
v20.9.0
```

## Usage

- AdministratorAccess のIAMポリシーをアタッチされたIAMユーザを作成し、そのユーザのアクセスキーIDとシークレットアクセスキーを取得する
- `aws configure --profile <適当なプロファイル名>` を実行して、アクセスキーIDとシークレットアクセスキーを設定する
- 下記コマンドを実行して、AWS CDK を用いてアプリケーションスタックをデプロイする準備を行う

```shell
npm run cdk bootstrap -- --profile <プロファイル名> -c stage=<dev | prod>
```

- 下記コマンドを実行して、アプリケーションスタックをデプロイする

```shell
npm run cdk deploy -- --profile <プロファイル名> -c stage=<dev | prod>
```

下記コマンドを実行して、アプリケーションスタックを削除する
```shell
npm run cdk destroy -- --profile <プロファイル名> -c stage=<dev | prod>
```

> `npm run cdk bootstrap` 実行時に作成されたブートストラップスタックは AWS CloudFormation コンソールから手動で削除する
