<?php

declare(strict_types=1);

namespace App\Controller\OAuth2;

use League\Bundle\OAuth2ServerBundle\Converter\UserConverterInterface;
use League\Bundle\OAuth2ServerBundle\Manager\ClientManagerInterface;
use League\Bundle\OAuth2ServerBundle\Manager\DeviceCodeManagerInterface;
use League\OAuth2\Server\AuthorizationServer;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormError;
use Symfony\Component\Form\SubmitButton;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\UriSigner;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\GoneHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * @author Antonio J. García Lagar <aj@garcialagar.es>
 */
final class DeviceController extends AbstractController
{
    public function __construct(
        private readonly UriSigner $uriSigner,
        private readonly DeviceCodeManagerInterface $deviceCodeManager,
        private readonly UserConverterInterface $userConverter,
        private readonly AuthorizationServer $authorizationServer,
    ) {
    }

    #[Route('/oauth2/device-verify', name: 'oauth2_device_verify', methods: ['GET', 'POST'])]
    public function verify(
        Request $request,
        #[MapQueryParameter('user_code')]
        ?string $userCode = null,
    ): Response {
        $form = $this->createFormBuilder(['userCode' => $userCode])
            ->add('userCode', TextType::class, [
                'required' => true,
            ])
            ->getForm()
            ->handleRequest($request)
        ;

        if ($form->isSubmitted() && $form->isValid()) {
            $userCode = $form->get('userCode')->getData();
            \assert(is_string($userCode));
            if (null !== $deviceCode = $this->deviceCodeManager->findByUserCode($userCode)) {
                return new RedirectResponse(
                    $this->uriSigner->sign(
                        $this->generateUrl('oauth2_device_decide', [
                            'device_code' => $deviceCode->getIdentifier(),
                        ], UrlGeneratorInterface::ABSOLUTE_URL)
                    )
                );
            }

            $form->get('userCode')->addError(new FormError('The provided user code is invalid.'));
        }

        return $this->render('oauth2/device_verify.html.twig', [
            'form' => $form,
        ]);
    }

    #[Route('/oauth2/device-decide', name: 'oauth2_device_decide', methods: ['GET', 'POST'])]
    #[IsGranted('ROLE_USER')]
    public function decide(
        Request $request,
        #[CurrentUser()] UserInterface $user,
        #[MapQueryParameter('device_code')] string $deviceCodeId,
    ): Response {
        if (!$this->uriSigner->checkRequest($request)) {
            throw new BadRequestHttpException('The request signature is invalid or has expired.');
        }

        if (null === $deviceCode = $this->deviceCodeManager->find($deviceCodeId)) {
            throw new BadRequestHttpException('The provided device code is invalid.');
        }

        if ($deviceCode->isRevoked()) {
            throw new GoneHttpException('The device code has been revoked.');
        }

        if ($deviceCode->getExpiry() < new \DateTimeImmutable()) {
            throw new GoneHttpException('The device code has expired.');
        }

        $form = $this->createFormBuilder()
            ->add('deny', SubmitType::class, [
                'label' => 'Deny',
                'attr' => ['class' => 'btn btn-outline-secondary btn-lg'],
            ])
            ->add('allow', SubmitType::class, [
                'label' => 'Allow',
                'attr' => ['class' => 'btn btn-primary btn-lg'],
            ])
            ->getForm()
            ->handleRequest($request)
        ;

        if ($form->isSubmitted() && $form->isValid()) {
            $allowButton = $form->get('allow');
            \assert($allowButton instanceof SubmitButton);

            $this->authorizationServer->completeDeviceAuthorizationRequest(
                $deviceCodeId,
                $this->userConverter->toLeague($user)->getIdentifier(),
                $allowButton->isClicked(),
            );

            return new RedirectResponse(
                $this->uriSigner->sign(
                    $this->generateUrl('oauth2_device_end', [
                        'device_code' => $deviceCodeId,
                    ], UrlGeneratorInterface::ABSOLUTE_URL)
                )
            );
        }

        return $this->render('oauth2/device_decide.html.twig', [
            'deviceCode' => $deviceCode,
            'form' => $form,
        ]);
    }

    #[Route('/oauth2/device-end', name: 'oauth2_device_end', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function end(
        Request $request,
        #[CurrentUser()] UserInterface $user,
        #[MapQueryParameter('device_code')] string $deviceCodeId,
    ): Response {
        if (!$this->uriSigner->checkRequest($request)) {
            throw new BadRequestHttpException('The request signature is invalid or has expired.');
        }

        if (null === $deviceCode = $this->deviceCodeManager->find($deviceCodeId)) {
            throw new BadRequestHttpException('The provided device code is invalid.');
        }

        if (null === $userIdentifier = $deviceCode->getUserIdentifier()) {
            throw new BadRequestHttpException('The device code has not been verified.');
        }

        if ($userIdentifier !== $this->userConverter->toLeague($user)->getIdentifier()) {
            $this->createAccessDeniedException('The device code was verified by a different user.');
        }

        if ($deviceCode->isRevoked()) {
            throw new GoneHttpException('The device code has been revoked.');
        }

        if ($deviceCode->getExpiry() < new \DateTimeImmutable()) {
            throw new GoneHttpException('The device code has expired.');
        }

        return $this->render('oauth2/device_end.html.twig', [
            'deviceCode' => $deviceCode,
        ]);
    }
}
