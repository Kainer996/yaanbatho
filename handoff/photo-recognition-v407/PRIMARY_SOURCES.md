# Primary sources consulted

- [BioCLIP 2.5 model and limitations](https://huggingface.co/imageomics/bioclip-2.5-vith14), pinned model revision 6e3d04e3d6522012c88181085c5ae666e14c45cd.
- [Matching text embeddings and taxonomy construction](https://huggingface.co/datasets/imageomics/TreeOfLife-200M/blob/main/embeddings/README.md), pinned dataset revision 5f2dc493b3dc0e544438a04038ab15faa646b749. Common-name selection takes the first English name rather than enforcing a unique nomenclature.
- [Author-provided text embedding recipe](https://github.com/Imageomics/TreeOfLife-toolbox/blob/main/processing/scripts/make_txt_embedding.py), retrieved source archived here. Full seven-rank taxonomy plus common name, the SINGLE template `an image of {c}.`, followed by normalization. The separate templates.py source confirmed this; the earlier 80-template exploratory probe was rejected.
- [Birder CAPI iNat21](https://huggingface.co/birder-project/rope_vit_reg4_b14_capi-inat21), pinned 2706e935a8f09eefffc925b74f8af65c4fd17274, older combined Herring Gull label; not a separate American/European discriminator.
- [European Herring Gull scientific identity, Cornell](https://birdsoftheworld.org/bow/species/euhgul1/1.0/introduction).
- [American Herring Gull scientific identity, BTO](https://www.bto.org/learn/about-birds/birdfacts/american-herring-gull).
- [ITIS European name change and IOC split](https://itis.gov/servlet/SingleRpt/SingleRpt?search_topic=TSN&search_value=176824).

These sources justify the diagnostic design, not a claim of verified field accuracy. Public image training overlap is unknown. User original photograph has not been supplied.
