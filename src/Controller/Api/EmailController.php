<?php

declare(strict_types=1);

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\InMemoryUser;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/email', name: 'api_email', methods: ['GET'])]
#[IsGranted('ROLE_OAUTH2_EMAIL')]
final class EmailController extends AbstractController
{
    public function __invoke(
        #[CurrentUser] InMemoryUser $user,
    ): Response {
        return $this->json([
            'email' => $user->getUserIdentifier(),
            'email_verified' => true,
        ]);
    }
}
