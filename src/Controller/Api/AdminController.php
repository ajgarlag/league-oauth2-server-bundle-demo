<?php

declare(strict_types=1);

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\ExpressionLanguage\Expression;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin', name: 'api_admin', methods: ['GET'])]
#[IsGranted(new Expression('is_granted("ROLE_OAUTH2_EMAIL") and is_granted("ROLE_ADMIN")'))]
final class AdminController extends AbstractController
{
    public function __invoke(): Response {
        return $this->json([
            'is_admin' => $this->isGranted('ROLE_ADMIN'),
        ]);
    }
}
