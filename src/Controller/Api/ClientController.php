<?php

declare(strict_types=1);

namespace App\Controller\Api;

use League\Bundle\OAuth2ServerBundle\Manager\ClientManagerInterface;
use League\Bundle\OAuth2ServerBundle\Security\User\ClientCredentialsUser;
use League\Bundle\OAuth2ServerBundle\ValueObject\Grant;
use League\Bundle\OAuth2ServerBundle\ValueObject\RedirectUri;
use League\Bundle\OAuth2ServerBundle\ValueObject\Scope;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api/client', name: 'api_client', methods: ['GET'])]
final class ClientController extends AbstractController
{
    public function __invoke(
        #[CurrentUser] ClientCredentialsUser $clientCredentialsUser,
        ClientManagerInterface $clientManager,
    ): Response {
        $client = $clientManager->find($clientCredentialsUser->getUserIdentifier());

        if (null === $client) {
            throw new ServiceUnavailableHttpException();
        }

        return $this->json([
            'identifier' => $client->getIdentifier(),
            'name' => $client->getName(),
            'redirectUris' => array_map(fn (RedirectUri $uri): string => $uri->__toString(), $client->getRedirectUris()),
            'scopes' => array_map(fn (Scope $scope): string => $scope->__toString(), $client->getScopes()),
            'grants' => array_map(fn (Grant $grant): string => $grant->__toString(), $client->getGrants()),
        ]);
    }
}
