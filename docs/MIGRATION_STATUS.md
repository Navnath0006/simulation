# Migration status

This repository contains a **partial migration of the portal presentation** into React. It must not be presented as a completed conversion of the original scientific applications.

| Area | Scope in this repository |
| --- | --- |
| Home and navigation | React informational portal with hash navigation |
| Module catalogue | Searchable informational descriptions; no executable module engines |
| Team and contact | Static informational content |
| Feedback | Omitted |
| Backend and database | Omitted; no runtime API or database is required |
| Scientific simulation engines | Not migrated or packaged |
| Scientific datasets and manuscripts | Not copied or distributed |
| Legacy HTML applications | Not embedded, proxied, or bundled |
| Deployment | Static build, CI, nginx container configuration, and optional manual Pages workflow |

The catalogue is an index of topics. A catalogue entry is not a runnable simulation, and a successful frontend build does not validate or reproduce legacy scientific results.

The legacy XAMPP project remains a separate source. This repository does not require that server or access to its filesystem. The frontend contains no database connection, feedback submission endpoint, or placeholder API that sends user input to a server.

Any future simulation work is outside this migration and requires its own requirements and review. Deployment readiness here refers only to serving the informational portal.
