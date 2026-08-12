<?php

namespace App\Controller\Admin;

use App\Form\ClientDataMapper;
use EasyCorp\Bundle\EasyAdminBundle\Config\KeyValueStore;
use EasyCorp\Bundle\EasyAdminBundle\Context\AdminContext;
use EasyCorp\Bundle\EasyAdminBundle\Controller\AbstractCrudController;
use EasyCorp\Bundle\EasyAdminBundle\Dto\EntityDto;
use EasyCorp\Bundle\EasyAdminBundle\Field\ArrayField;
use EasyCorp\Bundle\EasyAdminBundle\Field\IdField;
use EasyCorp\Bundle\EasyAdminBundle\Field\TextField;
use League\Bundle\OAuth2ServerBundle\Model\Client;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\FormBuilderInterface;

/**
 * @extends AbstractCrudController<Client>
 */
class ClientCrudController extends AbstractCrudController
{
    public static function getEntityFqcn(): string
    {
        return Client::class;
    }

    public function configureFields(string $pageName): iterable
    {
        return [
            IdField::new('identifier')->hideWhenUpdating(),
            TextField::new('name'),
            TextField::new('plainSecret', 'New secret')
                ->onlyOnForms()
                ->setFormType(PasswordType::class)
                ->setFormTypeOptions([
                    //     'type' => PasswordType::class,
                    'mapped' => false,
                    //     'first_options' => ['hash_property_path' => 'secret', 'label' => 'New secret'],
                    //     'second_options' => ['label' => 'Repeat secret'],
                ]),
            ArrayField::new('redirectUris', 'Redirect URIs')->hideOnIndex(),
            ArrayField::new('grants', 'Grants')->hideOnIndex(),
            ArrayField::new('scopes', 'Scopes')->hideOnIndex(),
        ];
    }

    public function createEntity(string $entityFqcn): ?object
    {
        return null;
    }

    public static function getSubscribedServices(): array
    {
        return array_merge(parent::getSubscribedServices(), [
            ClientDataMapper::class,
        ]);
    }

    /**
     * @return FormBuilderInterface<Client>
     */
    public function createNewFormBuilder(EntityDto $entityDto, KeyValueStore $formOptions, AdminContext $context): FormBuilderInterface
    {
        $formOptions->set('empty_data', null);

        $builder = parent::createNewFormBuilder($entityDto, $formOptions, $context);
        $this->setFormBuilderDataMapper($builder);

        return $builder;
    }

    /**
     * @return FormBuilderInterface<Client>
     */
    public function createEditFormBuilder(EntityDto $entityDto, KeyValueStore $formOptions, AdminContext $context): FormBuilderInterface
    {
        $builder = parent::createEditFormBuilder($entityDto, $formOptions, $context);
        $this->setFormBuilderDataMapper($builder);

        return $builder;
    }

    /**
     * @param FormBuilderInterface<Client> $builder
     */
    private function setFormBuilderDataMapper(FormBuilderInterface $builder): void
    {
        $clientDataMapper = $this->container->get(ClientDataMapper::class);
        assert($clientDataMapper instanceof ClientDataMapper);
        $builder->setDataMapper($clientDataMapper);
    }
}
