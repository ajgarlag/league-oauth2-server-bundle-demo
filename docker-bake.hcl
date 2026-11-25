target "default" {
  context = "vendor/lyrixx/php-wasm-builder/docker"
  # What is embedded, at EMBED_AT
  contexts = {
    embed = "build/embed"
  }
  args = {
    # Keep in sync with config.platform.php in composer.json
    PHP_VERSION = "8.2.36"
    EXTENSIONS = "ctype dom filter iconv mbstring openssl pdo_sqlite session simplexml tokenizer xml"
    EMBED_AT = "/app"
    MEMORY = "268435456"
    OPCACHE = "none"
    TARGETS = "web"
    WARMUP = "bin/console cache:warmup"
  }
  output = ["type=local,dest=wasm/build"]
}
