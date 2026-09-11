# Photo recognition verification fixtures

v393 corvid controls (RGB JPEG derivatives, EXIF removed; no sharpening or generated detail):
- raven-perched.jpg — Common Raven, Dick Daniels, 2008-04-14, CC BY-SA 3.0, re-encoded at original 2000×1500 size. https://commons.wikimedia.org/wiki/File:Common_Raven_(Corvus_corax)_RWD.jpg ; https://creativecommons.org/licenses/by-sa/3.0/
- raven-flight.jpg — Common Raven, Zeynel Cebeci, 2015-07-19, CC BY-SA 4.0, resized from 4468×3021 to 2560×1731. https://commons.wikimedia.org/wiki/File:Corvus_corax_-_Common_raven.jpg ; https://creativecommons.org/licenses/by-sa/4.0/
- carrion-crow.jpg — Carrion Crow, Richard Bartz, 2009-03-12, CC BY-SA 2.5, re-encoded at original 2100×1400 size. https://commons.wikimedia.org/wiki/File:Carrion_Crow_Corvus_corone.jpg ; https://creativecommons.org/licenses/by-sa/2.5/

The flight raven is a confusion control: a verified Raven or an explicit inconclusive result is allowed; Crow and provider failures both fail verification. The other two must identify the labelled species. The user's raven photos have not been supplied. Public fixtures do not establish field accuracy.

Real positive controls:
- robin-clear.jpg — European robin, C-M, 2022-02-12, CC BY-SA 4.0. Source: https://commons.wikimedia.org/wiki/File:Erithacus_rubecula_profile.jpg ; 960px thumbnail.
- great-tit-clear.jpg — Great tit, Lars A, 2014-03-11, CC BY-SA 4.0. Source: https://commons.wikimedia.org/wiki/File:Parus_major,_Great_Tit,_Talgoxe,_Malm%C3%B6,_Sweden.jpg ; original 744x560.
License: https://creativecommons.org/licenses/by-sa/4.0/

blurred-bird.jpg is a Gaussian-blurred derivative of the credited robin (same license). Empty scene, distant dark blob and geometric nonbird are synthetic QA fixtures generated locally, not real sightings. The user's kestrel photo was not supplied; the blob represents that failure class only. These files are used solely for model verification and never fed to game discovery/rewards.
