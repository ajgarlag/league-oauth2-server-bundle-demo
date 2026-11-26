<?php

namespace App\Controller\Admin;

use EasyCorp\Bundle\EasyAdminBundle\Config\Action;
use EasyCorp\Bundle\EasyAdminBundle\Config\Actions;
use EasyCorp\Bundle\EasyAdminBundle\Config\Crud;
use EasyCorp\Bundle\EasyAdminBundle\Controller\AbstractCrudController;
use EasyCorp\Bundle\EasyAdminBundle\Field\ArrayField;
use EasyCorp\Bundle\EasyAdminBundle\Field\AssociationField;
use EasyCorp\Bundle\EasyAdminBundle\Field\DateTimeField;
use EasyCorp\Bundle\EasyAdminBundle\Field\IdField;
use EasyCorp\Bundle\EasyAdminBundle\Field\TextField;
use League\Bundle\OAuth2ServerBundle\Model\AuthorizationCode;
use League\Bundle\OAuth2ServerBundle\Model\ClientInterface;

/**
 * @extends AbstractCrudController<AuthorizationCode>
 */
class AuthorizationCodeCrudController extends AbstractCrudController
{
    public static function getEntityFqcn(): string
    {
        return AuthorizationCode::class;
    }

    public function configureFields(string $pageName): iterable
    {
        return [
            IdField::new('identifier'),
            DateTimeField::new('expiry'),
            AssociationField::new('client')->autocomplete(
                callback: static fn (ClientInterface $client): string => $client->getIdentifier()
            ),
            TextField::new('userIdentifier'),
            ArrayField::new('scopes', 'Scopes')->hideOnIndex(),
        ];
    }

    public function configureActions(Actions $actions): Actions
    {
        return $actions
            ->disable(Action::NEW, Action::EDIT)
            ->set(Crud::PAGE_INDEX, Action::DETAIL)
        ;
    }
}
