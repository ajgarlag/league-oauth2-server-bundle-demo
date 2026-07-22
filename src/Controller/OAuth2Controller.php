<?php

declare(strict_types=1);

namespace App\Controller;

use App\EventSubscriber\SignedAuthorizationRequestSubscriber;
use League\Bundle\OAuth2ServerBundle\Manager\ClientManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\UriSigner;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * @author Antonio J. García Lagar <aj@garcialagar.es>
 */
final class OAuth2Controller extends AbstractController
{
    public function __construct(
        private readonly UriSigner $uriSigner,
        private readonly ClientManagerInterface $clientManager,
        private readonly string $authorizationRoute = 'oauth2_authorize',
    ) {
    }

    /*
     * The $user argument type (?User) must be nullable because the login page
     * must be accessible to anonymous visitors too.
     */
    #[Route('/oauth2/decide', name: 'oauth2_decide')]
    #[IsGranted('ROLE_USER')]
    public function decide(
        Request $request,
        #[MapQueryParameter('client_id')] string $clientId,
        #[MapQueryParameter('redirect_uri')] string $redirectUri,
        #[MapQueryParameter('scope')] string $scope = '',
    ): Response {
        $client = $this->clientManager->find($clientId);
        if (null === $client) {
            throw new BadRequestHttpException();
        }

        $scopes = '' === $scope ? array_map(strval(...), $client->getScopes()) : explode(' ', $scope);

        return $this->render('oauth2/decide.html.twig', [
            'client' => $client,
            'redirect_uri' => $redirectUri,
            'scopes' => $scopes,
            'allow_uri' => $this->buildDecidedUri($request, true),
            'deny_uri' => $this->buildDecidedUri($request, false),
        ]);
    }

    private function buildDecidedUri(Request $request, bool $allowed)
    {
        $currentQuery = $request->query->all();
        $decidedQuery = array_merge($currentQuery, [SignedAuthorizationRequestSubscriber::ATTRIBUTE_DECISION => $this->buildDecisionValue($allowed)]);
        $decidedUri = $this->generateUrl($this->authorizationRoute, $decidedQuery);

        return $this->uriSigner->sign($decidedUri);
    }

    private function buildDecisionValue(bool $allowed): string
    {
        return $allowed ? SignedAuthorizationRequestSubscriber::ATTRIBUTE_DECISION_ALLOW : '';
    }
}
