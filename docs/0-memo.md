- AutoScalingグループで設定した動的スケーリングポリシーによってオートスケーリングしても、最大キャパシティ以上にはインスタンスは増えない
- ターゲット追跡スケーリングは、AutoScalingグループ内のインスタンスだけのメトリクスを使う(他のAutoScalingグループは関係ない)
- ALBは、CloudWatch の「すべてのメトリクス > AppELB別、TG別メトリクス」上にターゲットグループ別のRequestCountのメトリクスが存在する