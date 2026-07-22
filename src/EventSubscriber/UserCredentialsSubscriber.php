<?php

declare(strict_types=1);

namespace App\EventSubscriber;

use League\Bundle\OAuth2ServerBundle\Event\UserResolveEvent;
use League\Bundle\OAuth2ServerBundle\OAuth2Events;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

class UserCredentialsSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly UserProviderInterface $userProvider,
        private readonly UserPasswordHasherInterface $userPasswordHasher,
    ) {
    }

    public function __invoke(UserResolveEvent $event): void
    {
        if (null === $user = $this->userProvider->loadUserByIdentifier($event->getUsername())) {
            return;
        }

        if (!$user instanceof PasswordAuthenticatedUserInterface) {
            return;
        }

        if ($this->userPasswordHasher->isPasswordValid($user, $event->getPassword())) {
            $event->setUser($user);
        }
    }

    public static function getSubscribedEvents(): array
    {
        return [
            OAuth2Events::USER_RESOLVE => '__invoke',
        ];
    }
}
