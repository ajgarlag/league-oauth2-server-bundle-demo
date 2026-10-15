<?php

namespace App\Controller\Admin;

use EasyCorp\Bundle\EasyAdminBundle\Config\Action;
use EasyCorp\Bundle\EasyAdminBundle\Config\Actions;
use EasyCorp\Bundle\EasyAdminBundle\Config\Crud;
use EasyCorp\Bundle\EasyAdminBundle\Controller\AbstractCrudController;
use EasyCorp\Bundle\EasyAdminBundle\Field\ArrayField;
use EasyCorp\Bundle\EasyAdminBundle\Field\AssociationField;
use EasyCorp\Bundle\EasyAdminBundle\Field\BooleanField;
use EasyCorp\Bundle\EasyAdminBundle\Field\DateTimeField;
use EasyCorp\Bundle\EasyAdminBundle\Field\IdField;
use EasyCorp\Bundle\EasyAdminBundle\Field\IntegerField;
use EasyCorp\Bundle\EasyAdminBundle\Field\TextField;
use League\Bundle\OAuth2ServerBundle\Model\ClientInterface;
use League\Bundle\OAuth2ServerBundle\Model\DeviceCode;

/**
 * @extends AbstractCrudController<DeviceCode>
 */
class DeviceCodeCrudController extends AbstractCrudController
{
    public static function getEntityFqcn(): string
    {
        return DeviceCode::class;
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
            TextField::new('userCode'),
            BooleanField::new('userApproved'),
            TextField::new('verificationUri')->hideOnIndex(),
            DateTimeField::new('lastPolledAt')->hideOnIndex(),
            IntegerField::new('pollingInterval')->hideOnIndex(),
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
