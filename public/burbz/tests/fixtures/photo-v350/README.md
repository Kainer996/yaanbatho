# Photo recognition verification fixtures

Real positive controls:
- robin-clear.jpg — European robin, C-M, 2022-02-12, CC BY-SA 4.0. Source: https://commons.wikimedia.org/wiki/File:Erithacus_rubecula_profile.jpg ; 960px thumbnail.
- great-tit-clear.jpg — Great tit, Lars A, 2014-03-11, CC BY-SA 4.0. Source: https://commons.wikimedia.org/wiki/File:Parus_major,_Great_Tit,_Talgoxe,_Malm%C3%B6,_Sweden.jpg ; original 744x560.
License: https://creativecommons.org/licenses/by-sa/4.0/

blurred-bird.jpg is a Gaussian-blurred derivative of the credited robin (same license). Empty scene, distant dark blob and geometric nonbird are synthetic QA fixtures generated locally, not real sightings. The user's kestrel photo was not supplied; the blob represents that failure class only. These files are used solely for model verification and never fed to game discovery/rewards.
