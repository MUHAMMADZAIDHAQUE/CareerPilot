import re
from typing import Dict, Any, List, Optional, Tuple, Set
from backend.app.core.logging import logger


class CareerSkillGapAgent:
    """
    Career Skill Gap Agent.
    Analyzes candidate verified profile against target jobs (saved, applied, rejected),
    identifies recurring skill gaps, computes demand frequency, determines current strength,
    and synthesizes a personalized learning roadmap and recommended projects.

    STRICT GUARDRAIL:
    Do not claim a skill is missing if it exists in the candidate profile.
    """

    KNOWN_PROJECT_BLUEPRINTS: Dict[str, Dict[str, Any]] = {
        "kubernetes": {
            "title": "Production Kubernetes Microservices Deployment",
            "description": "Deploy a multi-service containerized architecture to a local/cloud K8s cluster with ingress, HPA autoscaling, and zero-downtime rolling updates.",
            "key_features": [
                "Helm charts for multi-environment configuration (dev/staging/prod)",
                "Horizontal Pod Autoscaling (HPA) triggered by custom CPU/RPS metrics",
                "Ingress controller with TLS termination and canary deployments",
            ],
            "deliverables": "Working Helm charts, Kubernetes manifests, and a post-mortem incident simulation document.",
        },
        "rag": {
            "title": "Enterprise RAG Pipeline with pgvector & Semantic Caching",
            "description": "Build an end-to-end Retrieval-Augmented Generation system using PostgreSQL pgvector, hybrid BM25 search, and semantic Redis caching.",
            "key_features": [
                "Document chunking and dense vector embedding pipeline with OpenAI/HuggingFace",
                "Re-ranking layer for cross-encoder precision filtering",
                "Sub-50ms semantic query cache minimizing duplicate LLM inference calls",
            ],
            "deliverables": "FastAPI service with ingestion endpoint, evaluation benchmark script, and latency dashboard.",
        },
        "docker": {
            "title": "Optimized Multi-Stage Container Pipeline",
            "description": "Containerize a full-stack polyglot application with hardened multi-stage builds, non-root users, and automated vulnerability scanning.",
            "key_features": [
                "Multi-stage Dockerfile slashing image size from 1.2GB to <95MB",
                "Docker Compose setup orchestrating API, Database, and Cache with health checks",
                "Trivy vulnerability scanning integrated into GitHub Actions CI",
            ],
            "deliverables": "Slim production Dockerfiles, docker-compose.yml, and automated CI security pipeline.",
        },
        "kafka": {
            "title": "Distributed Event-Driven Payment Streaming Platform",
            "description": "Architect a real-time event streaming pipeline using Apache Kafka with consumer groups, exactly-once semantics, and dead-letter queues.",
            "key_features": [
                "Idempotent event producers with transactional guarantees",
                "Consumer group rebalancing and backpressure handling",
                "Dead-letter queue (DLQ) automated replay mechanism for poison pill messages",
            ],
            "deliverables": "Kafka producer/consumer codebase, event schema registry, and integration test suite.",
        },
        "redis": {
            "title": "Distributed Cache & Rate Limiting Engine",
            "description": "Design a high-throughput caching and distributed rate limiting tier with Redis cluster, handling 20,000+ RPS under write-heavy loads.",
            "key_features": [
                "Token bucket and sliding window rate limiting algorithms in Lua scripts",
                "Cache-aside and write-through invalidation with TTL jitter to prevent stampedes",
                "Redis Sentinel / Cluster failover configuration",
            ],
            "deliverables": "Reusable Redis middleware library, benchmark load test script, and Grafana dashboard.",
        },
        "graphql": {
            "title": "Federated GraphQL API Gateway",
            "description": "Build a unified GraphQL gateway aggregating multiple REST and gRPC microservices with schema stitching and dataloader batching.",
            "key_features": [
                "N+1 query resolution using DataLoader batching and caching",
                "Field-level authentication and rate-limiting directives",
                "Automated schema stitching across backend domains",
            ],
            "deliverables": "Apollo/Strawberry GraphQL gateway, subgraph mock services, and query performance report.",
        },
        "terraform": {
            "title": "Infrastructure as Code (IaC) AWS Cloud Foundation",
            "description": "Provision a secure, multi-AZ cloud architecture on AWS using reusable Terraform modules with state locking.",
            "key_features": [
                "VPC with public/private subnets, NAT gateways, and security groups",
                "ECS Fargate or EKS cluster deployment with IAM least-privilege roles",
                "Remote S3 backend with DynamoDB state locking and CI/CD validation",
            ],
            "deliverables": "Modular Terraform configurations, automated plan/apply GitHub Action, and architecture diagram.",
        },
        "system design": {
            "title": "High-Throughput URL Shortener & Analytics Engine",
            "description": "Architect a globally distributed system handling 100M daily active requests with Base62 encoding, distributed IDs, and Redis caching.",
            "key_features": [
                "Snowflake or ticket server distributed ID generation",
                "Read-heavy database sharding strategy with master-replica replication",
                "Real-time click analytics pipeline using message queues and time-series aggregation",
            ],
            "deliverables": "System design RFC document, data model schema, and working prototype with stress benchmarks.",
        },
    }

    KNOWN_LEARNING_PATHS: Dict[str, List[str]] = {
        "kubernetes": [
            "Master container runtime concepts: Pod lifecycle, namespaces, cgroups, and resource limits.",
            "Build hands-on declarative manifests: Deployments, Services, ConfigMaps, Secrets, and Ingress controllers.",
            "Implement production resilience: Horizontal Pod Autoscaling (HPA), liveness/readiness probes, and Helm chart packaging.",
        ],
        "rag": [
            "Understand vector embeddings, similarity metrics (cosine, inner product), and index algorithms (HNSW, IVFFlat).",
            "Implement document parsing, semantic chunking strategies, and metadata filtering with PostgreSQL pgvector.",
            "Integrate advanced retrieval: Hybrid BM25 + dense search, cross-encoder re-ranking, and context window optimization.",
        ],
        "docker": [
            "Learn container isolation primitives (Linux namespaces, cgroups, copy-on-write union filesystems).",
            "Write hardened multi-stage Dockerfiles optimizing layer caching and minimizing final image footprints.",
            "Orchestrate multi-container dev/test environments using Docker Compose with volume persistence and health checks.",
        ],
        "kafka": [
            "Understand Kafka architecture: Brokers, topics, partitions, consumer groups, and offset management.",
            "Implement resilient producers with idempotence, ACKs=all, and consumer retry policies with Dead Letter Queues (DLQ).",
            "Study event-driven architectures, stream processing patterns, and partition rebalancing semantics.",
        ],
        "redis": [
            "Master Redis data structures: Hashes, Sorted Sets, Bitmaps, and HyperLogLogs.",
            "Implement caching strategies: Cache-aside, write-through, TTL jitter, and mutex locks against cache thundering herd.",
            "Build distributed rate limiters using atomic Redis Lua scripts.",
        ],
        "system design": [
            "Review foundational distributed systems theorems: CAP, PACELC, ACID vs. BASE, and consistency models.",
            "Master database scaling: Vertical vs. horizontal sharding, read replicas, and indexing tradeoffs.",
            "Design for failure: Circuit breakers, exponential backoff, rate limiting, and graceful degradation.",
        ],
    }

    @classmethod
    def _normalize_skill(cls, skill_name: str) -> str:
        """Normalizes skill names to handle aliases and casing."""
        s = skill_name.strip()
        lower = s.lower()
        alias_map = {
            "postgres": "PostgreSQL",
            "postgresql": "PostgreSQL",
            "k8s": "Kubernetes",
            "kubernetes": "Kubernetes",
            "py": "Python",
            "python": "Python",
            "fastapi": "FastAPI",
            "fast api": "FastAPI",
            "docker": "Docker",
            "containers": "Docker",
            "rag": "RAG",
            "retrieval augmented generation": "RAG",
            "sql": "SQL",
            "nosql": "NoSQL",
            "redis": "Redis",
            "kafka": "Kafka",
            "apache kafka": "Kafka",
            "aws": "AWS",
            "amazon web services": "AWS",
            "gcp": "GCP",
            "google cloud": "GCP",
            "react": "React",
            "reactjs": "React",
            "react.js": "React",
            "next": "Next.js",
            "nextjs": "Next.js",
            "next.js": "Next.js",
            "typescript": "TypeScript",
            "ts": "TypeScript",
            "javascript": "JavaScript",
            "js": "JavaScript",
            "graphql": "GraphQL",
            "terraform": "Terraform",
            "ci/cd": "CI/CD",
            "cicd": "CI/CD",
            "microservices": "Microservices",
            "system design": "System Design",
            "distributed systems": "Distributed Systems",
        }
        return alias_map.get(lower, s)

    @classmethod
    def _find_candidate_evidence(
        cls,
        normalized_skill: str,
        candidate_skills: List[Dict[str, Any]],
        candidate_projects: List[Dict[str, Any]],
        candidate_experiences: List[Dict[str, Any]],
    ) -> Tuple[str, str]:
        """
        Searches candidate profile for evidence of a skill.
        Returns:
            (current_strength, evidence_description)
            current_strength is one of: "Strong", "Medium", "Weak", "Missing"

        CRITICAL RULE:
        Do not claim a skill is missing if it exists in the candidate profile.
        """
        norm_lower = normalized_skill.lower()

        # 1. Search in Candidate Skills
        skill_matches = []
        for s in candidate_skills:
            s_name = s.get("name", "").strip().lower()
            if s_name == norm_lower or norm_lower in s_name or s_name in norm_lower:
                skill_matches.append(s)

        # 2. Search in Candidate Projects
        project_matches = []
        for p in candidate_projects:
            techs = [t.lower().strip() for t in p.get("technologies", [])]
            p_desc = (p.get("description") or "").lower()
            p_title = (p.get("title") or p.get("name") or "").lower()
            if any(t == norm_lower or norm_lower in t for t in techs) or norm_lower in p_desc or norm_lower in p_title:
                project_matches.append(p)

        # 3. Search in Candidate Experiences
        exp_matches = []
        for e in candidate_experiences:
            techs = [t.lower().strip() for t in e.get("technologies_used", [])]
            bullets = " ".join(e.get("bullet_points", [])).lower()
            desc = (e.get("description") or "").lower()
            if any(t == norm_lower or norm_lower in t for t in techs) or norm_lower in bullets or norm_lower in desc:
                exp_matches.append(e)

        has_profile_skill = len(skill_matches) > 0
        has_project_evidence = len(project_matches) > 0
        has_experience_evidence = len(exp_matches) > 0

        # If completely absent from all three sources:
        if not has_profile_skill and not has_project_evidence and not has_experience_evidence:
            return "Weak", "No verified evidence found in candidate profile or projects."

        # It EXISTS in the candidate profile: NEVER claim it is missing!
        # Assess whether it's Strong vs Medium:
        evidence_parts = []
        proficiency = "Intermediate"

        if skill_matches:
            s_obj = skill_matches[0]
            prof = s_obj.get("proficiency") or s_obj.get("proficiency_level") or "Verified"
            yrs = s_obj.get("years_of_experience")
            yrs_str = f" ({yrs} yrs)" if yrs else ""
            evidence_parts.append(f"Listed in Skills: {prof}{yrs_str}")
            proficiency = prof

        if project_matches:
            p_first = project_matches[0]
            p_name = p_first.get("title") or p_first.get("name") or "Project"
            evidence_parts.append(f"Used in Project: '{p_name}'")

        if exp_matches:
            e_first = exp_matches[0]
            role = e_first.get("role") or "Software Engineer"
            comp = e_first.get("company") or "Company"
            evidence_parts.append(f"Applied in Experience: {role} at {comp}")

        # Strong criteria:
        # - Has project/experience proof + listed skill, OR
        # - Proficiency is Advanced/Senior/Expert, OR
        # - Multiple project/experience implementations
        is_strong = (
            (has_project_evidence and (has_profile_skill or has_experience_evidence))
            or (proficiency.lower() in ["advanced", "senior", "expert", "lead"])
            or (len(project_matches) + len(exp_matches) >= 2)
        )

        if is_strong:
            return "Strong", " • ".join(evidence_parts)
        else:
            return "Medium", " • ".join(evidence_parts)

    @classmethod
    def _generate_generic_learning_path(cls, skill: str) -> List[str]:
        return [
            f"Review official documentation and core architectural mental models for {skill}.",
            f"Build a focused working proof-of-concept demonstrating {skill} configuration, data flow, and error handling.",
            f"Benchmark performance, test boundary edge cases, and integrate into a production-grade CI/CD pipeline.",
        ]

    @classmethod
    def _generate_generic_project(cls, skill: str) -> Dict[str, Any]:
        return {
            "title": f"Production-Grade {skill} Microservice",
            "description": f"Architect and deploy a high-performance backend module utilizing {skill} with automated testing, observability, and containerized deployment.",
            "key_features": [
                f"Core {skill} integration adhering to industry design patterns",
                "Automated unit and integration test suite with >80% coverage",
                "Docker containerization with health checks and metrics endpoint",
            ],
            "deliverables": f"GitHub repository with README architecture diagram, benchmark results, and deployment script.",
        }

    # -------------------------------------------------------------------------
    # Main Analysis Entrypoint
    # -------------------------------------------------------------------------
    @classmethod
    def analyze_skill_gaps(
        cls,
        candidate_data: Dict[str, Any],
        target_jobs: List[Dict[str, Any]],
        applications: Optional[List[Dict[str, Any]]] = None,
        match_results: Optional[List[Dict[str, Any]]] = None,
        career_preferences: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Executes comprehensive Career Skill Gap Analysis.
        """
        candidate_id = candidate_data.get("id") or "candidate_1"
        candidate_name = candidate_data.get("full_name") or "Candidate"
        cand_skills = candidate_data.get("skills") or []
        cand_projects = candidate_data.get("projects") or []
        cand_experiences = candidate_data.get("experiences") or []

        # 1. Aggregate Target Jobs (Saved, Applied, Target Roles)
        # Combine target_jobs with any jobs from applications
        job_map: Dict[str, Dict[str, Any]] = {}
        for j in target_jobs:
            if j.get("id"):
                job_map[str(j["id"])] = j

        saved_count = 0
        applied_count = 0

        if applications:
            for app in applications:
                status = (app.get("status") or "").upper()
                if status in ["SAVED", "READY_TO_APPLY"]:
                    saved_count += 1
                elif status in ["APPLIED", "SCREENING", "INTERVIEW", "TECHNICAL", "FINAL_ROUND", "OFFER", "REJECTED", "WITHDRAWN"]:
                    applied_count += 1

                job_obj = app.get("job")
                if job_obj and isinstance(job_obj, dict) and job_obj.get("id"):
                    job_map[str(job_obj["id"])] = job_obj

        all_target_jobs = list(job_map.values())
        total_jobs_count = max(1, len(all_target_jobs))

        # 2. Count Skill Demand Frequency Across All Target Jobs
        skill_frequency: Dict[str, int] = {}
        skill_categories: Dict[str, str] = {}

        for j in all_target_jobs:
            reqs = [cls._normalize_skill(s) for s in (j.get("required_skills") or []) if s.strip()]
            prefs = [cls._normalize_skill(s) for s in (j.get("preferred_skills") or []) if s.strip()]
            techs = [cls._normalize_skill(s) for s in (j.get("technologies") or []) if s.strip()]

            # De-duplicate within the same job
            unique_job_skills = list(dict.fromkeys(reqs + prefs + techs))
            for s in unique_job_skills:
                skill_frequency[s] = skill_frequency.get(s, 0) + 1

        # Also incorporate any missing skills from MatchResults if present
        if match_results:
            for m in match_results:
                missing_req = m.get("missing_required_skills") or []
                for ms in missing_req:
                    norm = cls._normalize_skill(ms)
                    skill_frequency[norm] = max(skill_frequency.get(norm, 0), 1)

        # Include candidate's own preferred skills from CareerPreference
        if career_preferences:
            for pref_skill in career_preferences.get("preferred_skills", []):
                norm = cls._normalize_skill(pref_skill)
                if norm not in skill_frequency:
                    skill_frequency[norm] = 1

        # 3. Analyze each skill: Frequency, Strength, Priority, Learning Path, Project
        skill_gap_items: List[Dict[str, Any]] = []
        identified_gaps = 0
        strong_count = 0

        for skill, freq in sorted(skill_frequency.items(), key=lambda x: x[1], reverse=True):
            pct = round((freq / total_jobs_count) * 100.0, 1)

            strength, evidence = cls._find_candidate_evidence(
                normalized_skill=skill,
                candidate_skills=cand_skills,
                candidate_projects=cand_projects,
                candidate_experiences=cand_experiences,
            )

            # Determine Priority based on frequency and current strength
            if strength in ["Weak", "Missing"]:
                identified_gaps += 1
                if pct >= 50.0:
                    priority = "CRITICAL"
                elif pct >= 25.0:
                    priority = "HIGH"
                else:
                    priority = "MEDIUM"
            elif strength == "Medium":
                if pct >= 50.0:
                    priority = "HIGH"
                else:
                    priority = "MEDIUM"
            else:
                strong_count += 1
                priority = "LOW"

            # Recommended Learning Path & Project
            skill_lower = skill.lower()
            matched_key = None
            for k in cls.KNOWN_LEARNING_PATHS.keys():
                if k in skill_lower or skill_lower in k:
                    matched_key = k
                    break

            if matched_key:
                learning_path = cls.KNOWN_LEARNING_PATHS[matched_key]
                project = cls.KNOWN_PROJECT_BLUEPRINTS.get(matched_key) or cls._generate_generic_project(skill)
            else:
                learning_path = cls._generate_generic_learning_path(skill)
                project = cls._generate_generic_project(skill)

            skill_gap_items.append({
                "skill": skill,
                "frequency_count": freq,
                "frequency_percentage": pct,
                "candidate_evidence": evidence,
                "current_strength": strength,
                "priority": priority,
                "category": "Technical",
                "recommended_learning_path": learning_path,
                "recommended_project": project,
            })

        # 4. Compute Overall Market Readiness Score (0 - 100)
        # Based on coverage of demanded skills weighted by priority
        total_skills = len(skill_gap_items)
        if total_skills > 0:
            strong_weight = sum(1.0 for s in skill_gap_items if s["current_strength"] == "Strong")
            medium_weight = sum(0.6 for s in skill_gap_items if s["current_strength"] == "Medium")
            readiness = round(((strong_weight + medium_weight) / total_skills) * 100.0, 1)
        else:
            readiness = 80.0

        # 5. Synthesize Structured Learning Roadmap (3 Phases)
        critical_gaps = [s for s in skill_gap_items if s["priority"] == "CRITICAL"]
        high_gaps = [s for s in skill_gap_items if s["priority"] == "HIGH"]
        medium_skills = [s for s in skill_gap_items if s["priority"] == "MEDIUM"]

        phase1_skills = [s["skill"] for s in critical_gaps[:3]]
        if not phase1_skills:
            phase1_skills = [s["skill"] for s in high_gaps[:3]]
        if not phase1_skills:
            phase1_skills = [s["skill"] for s in skill_gap_items[:2]]

        phase2_skills = [s["skill"] for s in high_gaps if s["skill"] not in phase1_skills][:3]
        if not phase2_skills:
            phase2_skills = [s["skill"] for s in medium_skills[:3]]

        phase3_skills = [s["skill"] for s in medium_skills if s["skill"] not in phase1_skills and s["skill"] not in phase2_skills][:3]

        p1_project = critical_gaps[0]["recommended_project"]["title"] if critical_gaps else (high_gaps[0]["recommended_project"]["title"] if high_gaps else None)
        p2_project = high_gaps[0]["recommended_project"]["title"] if high_gaps else (medium_skills[0]["recommended_project"]["title"] if medium_skills else None)

        roadmap = [
            {
                "phase_name": "Phase 1: High-Priority Skill Gap Remediation",
                "timeline": "Weeks 1–2",
                "focus_skills": phase1_skills,
                "milestones": [
                    f"Complete fundamental architecture and API deep dive for {', '.join(phase1_skills)}.",
                    "Build a working proof-of-concept demonstrating failure resilience and configuration.",
                    "Review interview questions targeting these core competencies in the Interview Simulator.",
                ],
                "recommended_project": p1_project,
            },
            {
                "phase_name": "Phase 2: Portfolio Project Implementation",
                "timeline": "Weeks 3–4",
                "focus_skills": phase2_skills,
                "milestones": [
                    f"Integrate {', '.join(phase2_skills)} into an end-to-end portfolio project with measurable benchmarks.",
                    "Implement automated testing, multi-stage Docker builds, and deployment workflows.",
                    "Update master LaTeX resume to incorporate new verified project bullet points with concrete metrics.",
                ],
                "recommended_project": p2_project,
            },
            {
                "phase_name": "Phase 3: Production Hardening & Interview Readiness",
                "timeline": "Weeks 5–6",
                "focus_skills": phase3_skills if phase3_skills else phase1_skills,
                "milestones": [
                    "Conduct end-to-end latency profiling and load testing under concurrent stress.",
                    "Publish open-source repository with comprehensive README, architecture diagrams, and post-mortem notes.",
                    "Complete mock interview sessions for target roles achieving >85% evidence and structure scores.",
                ],
                "recommended_project": "Complete End-to-End System Benchmark & Public Deployment",
            },
        ]

        # 6. Executive Summary
        if readiness >= 80:
            summary = (
                f"{candidate_name} exhibits strong market readiness ({readiness}%) across {total_jobs_count} analyzed target jobs, "
                f"with {strong_count} verified core skills. Resolving {identified_gaps} targeted skill gaps will maximize interview conversion."
            )
        elif readiness >= 60:
            summary = (
                f"{candidate_name} possesses a solid technical baseline ({readiness}%) for target roles. "
                f"Addressing {identified_gaps} key skill gaps (particularly {', '.join(phase1_skills[:2])}) will dramatically elevate competitiveness."
            )
        else:
            summary = (
                f"{candidate_name} has high-potential foundational skills with {readiness}% market alignment. "
                f"Executing the 3-phase roadmap targeting {', '.join(phase1_skills)} will bridge critical requirement gaps."
            )

        return {
            "candidate_id": candidate_id,
            "candidate_name": candidate_name,
            "target_jobs_analyzed": total_jobs_count,
            "saved_jobs_count": saved_count,
            "applied_jobs_count": applied_count,
            "total_skills_demanded": total_skills,
            "market_readiness_score": readiness,
            "identified_gaps_count": identified_gaps,
            "skills": skill_gap_items,
            "roadmap": roadmap,
            "summary": summary,
        }
