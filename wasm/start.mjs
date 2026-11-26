// What starts the application, in the framed page, index.html, and in the
// service worker of standalone/. They share /symfony, where the database and
// the sessions are, kept in IndexedDB: keep in sync with ../app/.env and
// ../app/config/packages/framework.yaml

// What BuildIdWarmer writes, in the cache of Symfony, when the stack is built,
// and the one of the last run of the console. Keep in sync with
// ../app/src/BuildIdWarmer.php
const BUILD_ID = '/app/var/cache/dev/build-id';
const STARTED_BUILD_ID = '/league-oauth2-server-bundle-demo/build-id';

/**
 * Creates the database, once per build of the application: the console takes
 * most of the time PHP takes to start, and the stack already compiled the
 * container. With createPhp() or createPhpInWorker().
 */
export async function start(php) {
    // In PHP, not with php.FS: it does not see what IndexedDB has before the
    // first run
    const { stdout: started } = await php.runCode(`echo (int) (file_get_contents('${BUILD_ID}') === @file_get_contents('${STARTED_BUILD_ID}'));`);
    if ('1' === started) {
        return;
    }

    const { exitCode: dbExitCode, stdout: dbStdout, stderr: dbStderr } = await php.runFile('/app/bin/console', {
        args: [
            'doctrine:schema:update', '--force', '--no-interaction'
        ]
    });
    if (0 !== dbExitCode) {
        throw new Error(`The "doctrine:schema:update" command exited with ${dbExitCode}: ${dbStdout}\n${dbStderr}`);
    }

    const { exitCode: clientExitCode, stdout: clientStdout, stderr: clientStderr } = await php.runFile('/app/bin/console', {
        args: [
            'league:oauth2-server:create-client',
            '--redirect-uri=https://aj.garcialagar.es/league-oauth2-server-bundle-demo/client',
            '--grant-type=authorization_code',
            '--grant-type=implicit',
            '--grant-type=password',
            '--grant-type=client_credentials',
            '--grant-type=urn:ietf:params:oauth:grant-type:device_code',
            '--grant-type=refresh_token',
            '--scope=email',
            '--scope=profile',
            'Test Client',
            'test',
            'foobar'
        ]
    });
    if (0 !== clientExitCode) {
        throw new Error(`The "league:oauth2-server:create-client" command exited with ${clientExitCode}: ${clientStdout}\n${clientStderr}`);
    }

    const { exitCode: copyExitCode, stdout: copyStdout, stderr: copyStderr } = await php.runCode(`echo copy('${BUILD_ID}', '${STARTED_BUILD_ID}') ? 'OK' : 'KO';`);
    if ('OK' !== copyStdout) {
        throw new Error(`The build-id copy command exited with ${copyExitCode}: ${copyStdout}\n${copyStderr}`);
    }
}
