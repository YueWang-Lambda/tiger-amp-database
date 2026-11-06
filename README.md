<p align="center">
  <img src="frontend/static/css/tiger-icon.svg" width="88" alt="TIGER: a peptide helix balancing antimicrobial activity and host-cell response">
</p>

# TIGER AMP Database

**Therapeutic-Index-Guided Exploration and Refinement**

### Design for potency. Refine for selectivity.

TIGER is an antimicrobial peptide database that connects **antimicrobial activity, host-cell toxicity, molecular structures and experimental conditions** through peptide identity. It brings together evidence from original research to support the design of antimicrobial peptides with a high therapeutic index.

The database is built through AI-agent semantic reading and structured information extraction from original publications and supplementary materials. Peptide records connect molecular descriptions and quantitative observations to their source literature, helping researchers study potency and host-cell response together.

**[Explore TIGER](https://yuewang-lambda.github.io/tiger-amp-database/)** · [Browse peptides](https://yuewang-lambda.github.io/tiger-amp-database/search/) · [Download data](https://yuewang-lambda.github.io/tiger-amp-database/download/) · [Data guide](https://yuewang-lambda.github.io/tiger-amp-database/help/)

English · [中文介绍](README.zh-CN.md)

[![TIGER's interactive 3D overview connects literature, peptide chemistry, AI design and activity–toxicity evidence.](docs/images/tiger-3d-overview.png)](https://yuewang-lambda.github.io/tiger-amp-database/#apexd-observatory)

## Why TIGER?

Antimicrobial peptide discovery requires both activity against microorganisms and a favorable response in host cells. TIGER organizes these two sides of selectivity around the same peptide, while retaining the experimental context needed to interpret each measurement.

- **Connect activity and toxicity.** Explore peptide–strain and peptide–host relationships, then follow linked evidence for peptides studied on both sides.
- **Compare measurements in context.** Inspect endpoints, concentration units, reported bounds, culture media, assay conditions and figure-derived annotations.
- **Explore peptide chemistry.** Browse sequences, termini, modifications, molecular annotations, structural depictions and literature-reported SMILES.
- **Prepare data for computational research.** Download condition-class summaries and source-condition core tables, or export matching search results as CSV and source sequences as FASTA.
- **Return to the evidence.** Follow peptide records to source measurements, article references and aggregation provenance.

## Current collection

**Source-data release: 25 October 2026. Public-data package: 3 November 2026. Comparison audit revision: 6 November 2026; sequence and pairing snapshot: 4 November 2026.**

| Collection or evidence layer | Count |
| --- | ---: |
| Literature-specific peptide entity records | 50,992 |
| Entities with a recorded sequence | 40,986 |
| Core entities across the two unit datasets | 37,800 |
| Source publication references | 7,610 |
| Original measurement rows linked to archive entities | 346,095 |
| Original safety rows linked to archive entities | 36,218 |
| Peptide–strain activity relationships | 142,265 |
| Peptide–host toxicity relationships | 4,530 |
| Connected peptide × strain × host evidence links | 19,888 |

Entity counts use literature-specific identifiers: the same sequence reported under different entity IDs remains separately traceable. Recorded sequence fields retain source notation, including modified and unresolved residues.

The original long-table counts preserve source observations before endpoint, target, unit, value and aggregation rules. Ordinary MIC labels occur on 262,477 measurement rows. The [audited comparison](https://yuewang-lambda.github.io/tiger-amp-database/statistics/#source-record-coverage) separately presents original source rows, entry-level annotation coverage and shared-rule concentration signatures, together with source-literature coverage.

Activity relationships comprise **136,237 bacterial** and **6,028 fungal** strain relationships. The connected activity–toxicity layer covers **3,023 core entities**; each link joins a peptide, a microbial strain and a host cell line or erythrocyte source. These links support selectivity analyses with explicitly chosen endpoints, compatible units and assay context. See the [counting definitions](https://yuewang-lambda.github.io/tiger-amp-database/help/#experimental-relations).

## From literature to connected evidence

1. **Read the original research.** Extract peptide identities, sequences, chemical annotations, experimental measurements and source references from papers and supplements.
2. **Build the entity archive.** Keep each peptide's molecular descriptions and experimental evidence together in its literature context.
3. **Select core concentration evidence.** Apply endpoint, target/host, concentration-semantics, value and unit rules. The core collection is the union of the µg/mL and µM table memberships.
4. **Connect and summarize.** Resolve strain and host identities, link activity and toxicity through peptide IDs, and summarize MIC observations within defined condition classes.

The [complete archive](https://yuewang-lambda.github.io/tiger-amp-database/archive/) includes 13,192 additional entities beyond the core collection. Their molecular descriptions and source records remain available for exploration.

## Explore the database

| Page | What you can do |
| --- | --- |
| [Overview](https://yuewang-lambda.github.io/tiger-amp-database/) | Explore the evidence model and the interactive 3D view. |
| [Browse peptides](https://yuewang-lambda.github.io/tiger-amp-database/search/) | Search by ID, name, sequence or reference; combine molecular and concentration filters; export matching records. |
| [Connected evidence](https://yuewang-lambda.github.io/tiger-amp-database/relations/?kind=paired) | Explore activity and host-cell response linked through the same peptide. |
| [Source publications](https://yuewang-lambda.github.io/tiger-amp-database/publications/) | Find the research articles associated with entity records. |
| [Statistics](https://yuewang-lambda.github.io/tiger-amp-database/statistics/) | Review distributions, compare sequence coverage with DRAMP 5.0, DBAASP v4 and dbAMP 3.0, and inspect activity–toxicity evidence definitions and downloadable figures. |
| [Downloads & data](https://yuewang-lambda.github.io/tiger-amp-database/download/) | Download the main tables, release manifest and checksums. |
| [Data guide](https://yuewang-lambda.github.io/tiger-amp-database/help/) | Understand counts, condition classes, units, sequence annotations and source evidence. |

Try searching for [melittin](https://yuewang-lambda.github.io/tiger-amp-database/search/?query=melittin), or open the example record [AS0170-P2](https://yuewang-lambda.github.io/tiger-amp-database/peptide/?id=AS0170-P2). Browsing and downloading require no account.

## Download and use the data

The [Downloads page](https://yuewang-lambda.github.io/tiger-amp-database/download/) provides four main tables as compressed CSV files:

| Table | Unit | Rows | Row definition |
| --- | --- | ---: | --- |
| Peptide × condition class summary | µg/mL | 36,419 | One peptide entity and one MIC condition class |
| Peptide × condition class summary | µM | 39,803 | One peptide entity and one MIC condition class |
| Source-condition core table | µg/mL | 34,533 | One peptide entity, with condition-specific columns |
| Source-condition core table | µM | 37,800 | One peptide entity, with condition-specific columns |

For compact modelling tables, start with the **peptide × condition class summaries**. They organize MIC data into 20 fixed classes and retain peptide-level toxicity values. A peptide can occur in several condition-class rows; those rows share its toxicity values. Keep the same `split_group_id` within one training, validation or test partition, and use the linked eligibility and row-status information to select observations for the intended model. Follow the [training and condition-class rules](https://yuewang-lambda.github.io/tiger-amp-database/help/#condition-classes).

Preserve missing-value states and concentration bounds such as `>128`, `>=64` and `<0.5` during analysis. Public SMILES fields contain values reported in the original literature. The [Data guide](https://yuewang-lambda.github.io/tiger-amp-database/help/) explains unit coverage, sequence completeness and structural depictions.

Versioned deployment archives and checksums are available in [GitHub Releases](https://github.com/YueWang-Lambda/tiger-amp-database/releases). The four tables on the website are the main starting point for data analysis.

## Citation and contact

When using TIGER, identify **TIGER AMP Database (Therapeutic-Index-Guided Exploration and Refinement)**, its website URL and the dataset release. For record-level results, include peptide IDs and cite the original publications associated with the experimental findings.

- **Developer:** [YueWang-Lambda](https://github.com/YueWang-Lambda)
- **Laboratory:** [de la Fuente Lab, University of Pennsylvania](https://delafuentelab.engineering.upenn.edu/)
- **Corrections and feedback:** [GitHub Issues](https://github.com/YueWang-Lambda/tiger-amp-database/issues). Include the peptide ID, source reference, release and relevant field or page when reporting a data issue.

## Website implementation

This repository contains the public website source. GitHub Pages serves the site, while search, filtering and result exports run in the browser. Fixed-version public data and checksums support reproducible builds.

For local builds, deployment, updates and recovery, see the [maintenance guide](docs/MAINTENANCE.md).
