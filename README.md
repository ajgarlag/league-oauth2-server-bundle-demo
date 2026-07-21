# league-oauth2-server-bundle-demo

Demo application that showcases the integration of the League OAuth2 Server Bundle with a small Symfony app.

This repository contains a working demo of an OAuth2 authorization server and a minimal client UI used to exercise common OAuth2 flows (authorization code, PKCE, implicit, password, client credentials and refresh token).

Main features

- OAuth2 server endpoints and configuration using the League OAuth2 Server Bundle
- Simple client UI to test flows
- Example routes, controllers and entities to demonstrate clients, tokens and scopes

Getting started

1. Ensure PHP and Composer are installed.
1. Install PHP dependencies:

    ```bash
    composer install
    ```

1. Install JS dependencies:

    ```bash
    bin/console importmap:install
    ```

1. Execute the database migrations (it will create the sqlite database file):

    ```bash
    bin/console doctrine:migrations:migrate
    ```

1. Start the local server (example):

    ```bash
    php -S 127.0.0.1:8000 -t public
    ```

Using the demo client

- Open `/client` in your browser.
- Create a new OAuth2 client using the command provided in the UI.
- Fill in the Client ID and Client Secret created earlier.
- Test the flows using the buttons in the UI.

Notes

- This repository is intended for demo and development purposes only. Do not use it as-is in production.

License

This project is available under the MIT License.

Author

Antonio J. García Lagar <aj@garcialagar.es>