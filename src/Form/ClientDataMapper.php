<?php

namespace App\Form;

use League\Bundle\OAuth2ServerBundle\Model\Client;
use League\Bundle\OAuth2ServerBundle\ValueObject\Grant;
use League\Bundle\OAuth2ServerBundle\ValueObject\RedirectUri;
use League\Bundle\OAuth2ServerBundle\ValueObject\Scope;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Form\DataMapperInterface;
use Symfony\Component\Form\Exception\ErrorMappingException;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;

class ClientDataMapper implements DataMapperInterface
{
    public function __construct(
        #[Autowire(service: 'league.oauth2_server.password_hasher')]
        private PasswordHasherInterface $passwordHasher,
    ) {
    }

    /**
     * @param Client|null                        $viewData
     * @param \Traversable<FormInterface<mixed>> $forms
     */
    public function mapDataToForms($viewData, \Traversable $forms): void
    {
        if (null === $viewData) {
            return;
        }

        $forms = iterator_to_array($forms);

        if (isset($forms['identifier'])) {
            $forms['identifier']->setData($viewData->getIdentifier());
        }

        $forms['name']->setData($viewData->getName());
        $forms['redirectUris']->setData(array_map(fn (RedirectUri $redirectUri): string => (string) $redirectUri, $viewData->getRedirectUris()));
        $forms['grants']->setData(array_map(fn (Grant $grant): string => (string) $grant, $viewData->getGrants()));
        $forms['scopes']->setData(array_map(fn (Scope $scope): string => (string) $scope, $viewData->getScopes()));
    }

    /**
     * @param \Traversable<FormInterface<mixed>> $forms
     * @param Client|null                        $viewData
     */
    public function mapFormsToData(\Traversable $forms, &$viewData): void
    {
        $forms = iterator_to_array($forms);

        if (null !== $plainSecret = $forms['plainSecret']->getData()) {
            assert(is_string($plainSecret));
            $secret = $this->passwordHasher->hash($plainSecret);
        }

        $name = $forms['name']->getData();
        assert(is_string($name));
        $identifier = isset($forms['identifier']) ? $forms['identifier']->getData() : null;
        assert(is_string($identifier) || null === $identifier);

        if (null === $viewData) {
            assert(is_string($identifier) && '' !== $identifier);
            $viewData = new Client($name, $identifier, $secret ?? null);
        } elseif (null === $identifier || $viewData->getIdentifier() === $identifier) {
            $viewData->setName($name);
            if (isset($secret)) {
                $viewData->setSecret($secret);
            }
        } else {
            throw new ErrorMappingException('The identifier of the client cannot be changed.');
        }

        /** @var non-empty-string[] $redirectUris */
        $redirectUris = $forms['redirectUris']->getData();
        $viewData->setRedirectUris(...array_map(fn (string $redirectUri): RedirectUri => new RedirectUri($redirectUri), $redirectUris));

        /** @var non-empty-string[] $grants */
        $grants = $forms['grants']->getData();
        $viewData->setGrants(...array_map(fn (string $grant): Grant => new Grant($grant), $grants));

        /** @var non-empty-string[] $scopes */
        $scopes = $forms['scopes']->getData();
        $viewData->setScopes(...array_map(fn (string $scope): Scope => new Scope($scope), $scopes));
    }
}
