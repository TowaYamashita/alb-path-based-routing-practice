# ゴールデンイメージ作成にあたって実行したコマンド一覧

## システムのアップデートとパッケージのアップグレード
```shell
sudo dnf -y update
```

## タイムゾーンを Asia/Tokyo に変更
```shell
sudo timedatectl set-timezone Asia/Tokyo
```

## PHP,nginx をインストール
```shell
sudo dnf -y install php-fpm php-mysqli php-json php php-devel nginx
```

## システム起動時にPHP-FPMおよびnginxを自動的に起動するよう設定
```shell
sudo systemctl start nginx.service
sudo systemctl enable nginx.service

sudo systemctl start php-fpm.service
sudo systemctl enable php-fpm.service
```

## PHP-FPM設定ファイルを修正
```shell
sudo vi /etc/php-fpm.d/www.conf
```

```diff
; Unix user/group of processes
; Note: The user is mandatory. If the group is not set, the default user's group
;       will be used.
; RPM: apache user chosen to provide access to the same directories as httpd
-user = apache
+user = nginx

; RPM: Keep a group allowed to write in log dir.
-group = apache
+group = nginx

; Set permissions for unix socket, if one is used. In Linux, read/write
; permissions must be set in order to allow connections from a web server.
; Default Values: user and group are set as the running user
;                 mode is set to 0660
-listen.owner = nobody
+listen.owner = nginx
-listen.group = nobody
+listen.group = nginx
listen.mode = 0660
```

## ALBによるヘルスチェック用のパスを設定
```shell
sudo vi /etc/nginx/default.d/healthcheck.conf
```

```diff
+ location = /healthcheck.html {
+   empty_gif;
+   break;
+ }
```

## 修正した設定を反映
``` shell
sudo systemctl restart nginx.service
sudo systemctl restart php-fpm.service
```

# Ref
- https://dev.34-d.net/amazon-linux-2023-satrt-up/
- https://dev.34-d.net/install-php-on-al2023/
- https://dev.34-d.net/install-nginx-on-al2023/
- https://dev.34-d.net/link-nginx-and-php-fpm/
- https://qiita.com/yumiyon/items/5cd2c6b4c696355926dc
