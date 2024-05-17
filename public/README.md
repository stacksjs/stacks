# Public Files

Any files in this folder will be served as static files by the web server.

In other words, if you put a file in this folder, you can access it at `https://$APP_URL/your-file-name`.

Tip: when starting a Stacks project that utilizes media (images, videos, or audio), you will want to separate them into their respective public folders.

## In Practice

Let's say you want to overwrite the default `robots.txt` file. You can do this by putting a file named `robots.txt` in this folder.

If you want to overwrite the default `favicon.ico` file, you can do this by putting a file named `favicon.ico` in this folder.

## Security

If you want to make sure that a file is not publicly accessible, you can put it in the `storage/private` folder. This folder is not accessible by the web server.
