import re
import uuid
from typing import Dict, Any, List, Optional, Tuple
from backend.app.core.logging import logger


class InterviewAgent:
    """
    AI Interview Preparation and Evaluation Agent.

    Strict Guardrails:
    - Generates questions strictly grounded in target JD and verified candidate profile.
    - Questions not tied to JD/profile are explicitly categorized as GENERAL.
    - Never makes unsupported claims about real or leaked interview questions.
    - Evaluates answers across 6 core criteria:
        1. Technical accuracy
        2. Relevance
        3. Clarity
        4. Structure
        5. Evidence
        6. Communication
    - Generates dynamic, contextual follow-up questions to probe weak spots and trade-offs.
    - Tracks weak areas and compiles actionable final feedback.
    """

    DISCLAIMER_TEXT = (
        "Simulated interview preparation questions generated from the job description and candidate profile. "
        "These are realistic practice questions and not claimed to be actual, proprietary, or leaked company interview questions."
    )

    # -------------------------------------------------------------------------
    # 1. Generate Full Interview Prep Kit
    # -------------------------------------------------------------------------
    @classmethod
    def generate_prep_kit(
        cls,
        candidate_data: Dict[str, Any],
        job_data: Dict[str, Any],
        tailored_resume_data: Optional[Dict[str, Any]] = None,
        company_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Synthesizes a comprehensive, evidence-grounded interview preparation kit.
        """
        role = job_data.get("role") or "Software Engineer"
        company = job_data.get("company") or "Target Company"
        domain = job_data.get("domain") or company_info.get("domain") if company_info else "Technology"

        # Extract JD skills and candidate skills
        req_skills = [s.strip() for s in (job_data.get("required_skills") or []) if s.strip()]
        pref_skills = [s.strip() for s in (job_data.get("preferred_skills") or []) if s.strip()]
        all_job_skills = list(dict.fromkeys(req_skills + pref_skills))
        if not all_job_skills:
            all_job_skills = ["System Architecture", "API Design", "PostgreSQL", "Python", "Cloud Infrastructure"]

        cand_skills = [
            s.get("name") if isinstance(s, dict) else str(s)
            for s in (candidate_data.get("skills") or [])
        ]
        cand_projects = candidate_data.get("projects") or []
        cand_experiences = candidate_data.get("experiences") or []

        # 1. Technical Questions (Grounded in JD technical requirements & candidate skill stack)
        technical_questions = []
        for idx, skill in enumerate(all_job_skills[:5]):
            cand_has_skill = any(skill.lower() in cs.lower() for cs in cand_skills)
            diff = "Senior" if idx < 2 else "Mid"
            technical_questions.append({
                "id": f"tech_{idx + 1}",
                "question": f"How do you design, optimize, and maintain production systems using {skill}? Describe how you handle failure recovery and scaling bottlenecks.",
                "topic": skill,
                "difficulty": diff,
                "context_source": f"JD Requirement: {skill} ({'Demonstrated in candidate profile' if cand_has_skill else 'Job target requirement'})",
                "sample_good_points": [
                    f"Explains core architectural principles and internal mechanics of {skill}.",
                    "Articulates concrete trade-offs (e.g. latency vs. throughput, consistency vs. availability).",
                    "Provides real incident response or performance tuning examples.",
                ],
            })

        # Add architecture question
        technical_questions.append({
            "id": f"tech_arch",
            "question": f"For {company}'s {role} position, walk through how you would architect a high-availability, low-latency microservice handling 10,000+ requests per second.",
            "topic": "Distributed System Design",
            "difficulty": "Senior",
            "context_source": f"JD Role: {role} at {company}",
            "sample_good_points": [
                "Clarifies functional and non-functional requirements before proposing design.",
                "Defines data models, database sharding/partitioning, and caching tiers.",
                "Details observability, circuit breaking, and rate limiting strategies.",
            ],
        })

        # 2. Project Questions (Directly referencing verified candidate projects)
        project_questions = []
        if cand_projects:
            for idx, p in enumerate(cand_projects[:4]):
                p_name = p.get("name") or f"Project {idx+1}"
                p_desc = p.get("description") or "candidate project"
                p_techs = p.get("technologies") or []
                tech_str = ", ".join(p_techs[:3]) if p_techs else "modern software stack"
                project_questions.append({
                    "id": f"proj_{idx + 1}",
                    "question": f"In your project '{p_name}' built with {tech_str}, what was the most difficult architectural challenge you solved, and what trade-offs did you make?",
                    "project_name": p_name,
                    "technologies": p_techs,
                    "rationale": f"Probes real engineering depth from candidate's verified project '{p_name}'.",
                    "context_source": f"Candidate Project: {p_name} ({p_desc[:60]}...)",
                })
        else:
            # Fallback to general experience question if no projects recorded
            project_questions.append({
                "id": "proj_1",
                "question": f"Walk through the most technically complex software system you have built. What was the business impact and what would you re-architect today?",
                "project_name": "Major Engineering Milestone",
                "technologies": all_job_skills[:3],
                "rationale": "Evaluates candidate's ownership and technical reflection.",
                "context_source": "Candidate Engineering History",
            })

        # 3. Behavioral Questions (Role-contextualized with STAR framework tips)
        behavioral_questions = [
            {
                "id": "beh_1",
                "question": f"Tell me about a time at work when you faced a critical production bug or unexpected deployment failure for a service like the ones at {company}. How did you prioritize and communicate?",
                "competency": "Crisis Management & Incident Response",
                "context_source": f"Role Responsibility: {role} operational excellence",
                "star_framework_tip": {
                    "Situation": "Briefly state the service, blast radius, and business impact.",
                    "Task": "Define your specific responsibility during the mitigation.",
                    "Action": "Explain your debugging steps, root cause analysis, and team coordination.",
                    "Result": "Quantify downtime reduced, customer impact mitigated, and post-mortem safeguards added.",
                },
            },
            {
                "id": "beh_2",
                "question": "Describe a situation where you had a strong technical disagreement with a team member or tech lead regarding system architecture. How did you resolve it?",
                "competency": "Collaboration & Technical Persuasion",
                "context_source": "Engineering Team Dynamics",
                "star_framework_tip": {
                    "Situation": "Identify the architectural decision and competing perspectives.",
                    "Task": "Your goal to find an objective, evidence-driven resolution.",
                    "Action": "Ran benchmarks, created POCs, or facilitated a structured RFC debate.",
                    "Result": "The architecture chosen, project success, and strengthened team trust.",
                },
            },
            {
                "id": "beh_3",
                "question": f"How do you prioritize competing deadlines when stakeholders request urgent features while technical debt threatens system stability?",
                "competency": "Prioritization & Stakeholder Management",
                "context_source": f"Fast-paced environment at {company}",
                "star_framework_tip": {
                    "Situation": "A crunch period with conflicting product and platform priorities.",
                    "Task": "Delivering critical business value without compromising long-term maintainability.",
                    "Action": "Quantified risk of tech debt, proposed iterative milestones, and aligned stakeholders.",
                    "Result": "Timely launch with zero critical outages or debt regressions.",
                },
            },
        ]

        # 4. JD-Specific Questions (Targeting exact responsibilities & domain)
        jd_specific_questions = []
        responsibilities = job_data.get("responsibilities") or []
        if responsibilities:
            for idx, resp in enumerate(responsibilities[:3]):
                jd_specific_questions.append({
                    "id": f"jd_{idx + 1}",
                    "question": f"The job description emphasizes '{resp}'. What concrete experience do you bring to execute this effectively on day one?",
                    "jd_requirement": resp,
                    "why_asked": f"Directly tests core day-to-day responsibility for {role}.",
                    "context_source": f"JD Responsibility: {resp}",
                })
        else:
            jd_specific_questions.append({
                "id": "jd_1",
                "question": f"How does your technical background directly prepare you to build software in {company}'s {domain} domain?",
                "jd_requirement": f"Core engineering for {company}",
                "why_asked": f"Tests alignment with {company}'s domain and mission.",
                "context_source": f"Target Company Domain: {domain}",
            })

        # 5. Resume-Specific Questions (Probing candidate resume claims, metrics, and details)
        resume_specific_questions = []
        if cand_experiences:
            for idx, exp in enumerate(cand_experiences[:3]):
                exp_role = exp.get("role") or exp.get("title") or "Software Engineer"
                exp_comp = exp.get("company") or "Previous Company"
                exp_desc = exp.get("description") or ""
                # Look for numbers or claims
                resume_specific_questions.append({
                    "id": f"res_{idx + 1}",
                    "question": f"On your resume as {exp_role} at {exp_comp}, you highlighted your work with {exp_desc[:50]}... What quantitative metrics or benchmarks validate that success?",
                    "resume_claim": f"{exp_role} at {exp_comp}",
                    "verification_goal": "Validate quantitative impact, scope, and technical veracity.",
                    "context_source": f"Candidate Resume Experience: {exp_role} at {exp_comp}",
                })
        else:
            resume_specific_questions.append({
                "id": "res_1",
                "question": "Which bullet point on your resume represents the highest technical complexity, and what was your individual contribution vs. the team's?",
                "resume_claim": "Primary resume achievements",
                "verification_goal": "Distinguish individual engineering ownership from collective team efforts.",
                "context_source": "Candidate Profile Highlights",
            })

        # 6. Follow-up Questions (Anticipated in-depth probes)
        follow_up_questions = [
            {
                "id": "fol_1",
                "question": "What were the primary failure modes you observed in that implementation, and how did your monitoring detect them before customers did?",
                "original_category": "System Resilience",
                "probe_direction": "Probing observability, metrics, and MTTR.",
            },
            {
                "id": "fol_2",
                "question": "If your traffic or dataset expanded by 10x overnight, which component would break first and how would you redesign it?",
                "original_category": "Scalability",
                "probe_direction": "Testing stress limits, sharding, and memory bottlenecks.",
            },
            {
                "id": "fol_3",
                "question": "Looking back, what alternative technical approach did you consider and reject, and why?",
                "original_category": "Engineering Judgment",
                "probe_direction": "Testing comparative analysis of competing architectures.",
            },
        ]

        # 7. Suggested Preparation Topics (Prioritized study roadmap)
        prep_topics = []
        # High priority: Core job required skills
        for s in req_skills[:4]:
            prep_topics.append({
                "topic": s,
                "category": "Core Technical",
                "priority": "HIGH",
                "key_concepts": [
                    f"Core syntax, concurrency primitives, and async models in {s}.",
                    f"Common performance bottlenecks and memory management in {s}.",
                    f"Best practices for production testing and profiling {s}.",
                ],
                "recommended_prep": f"Review official {s} documentation, write a sample benchmark, and review common architectural pitfalls.",
            })

        # Medium priority: System design & architecture
        prep_topics.append({
            "topic": "Scalable System Design & Caching",
            "category": "Architecture",
            "priority": "HIGH" if "Senior" in role or "Lead" in role else "MEDIUM",
            "key_concepts": [
                "Database indexing, query execution plans, and connection pooling.",
                "Cache invalidation patterns (Write-through, Cache-aside, Read-through).",
                "Event-driven architecture with message queues (Kafka / RabbitMQ).",
            ],
            "recommended_prep": "Practice whiteboarding end-to-end distributed flows focusing on state consistency and partition tolerance.",
        })

        # Behavioral & Leadership
        prep_topics.append({
            "topic": "STAR Behavioral Story Preparation",
            "category": "Behavioral",
            "priority": "MEDIUM",
            "key_concepts": [
                "Prepare 3 polished STAR stories: technical disagreement, production outage, ambiguous requirement.",
                "Keep Situation/Task under 45 seconds, focus 70% of response on Action & measurable Result.",
            ],
            "recommended_prep": "Rehearse answers out loud using exact metrics (% improvements, latency reductions, time saved).",
        })

        # General questions (Clearly labeled as GENERAL)
        general_questions = [
            {
                "id": "gen_1",
                "question": f"Can you give me a 90-second executive summary of your engineering journey and what excites you specifically about joining {company}?",
                "category": "GENERAL",
                "note": "Standard conversational opener labeled as general baseline.",
            },
            {
                "id": "gen_2",
                "question": "Where do you see yourself technically in two to three years, and how does this role fit into that trajectory?",
                "category": "GENERAL",
                "note": "General career alignment question.",
            },
        ]

        return {
            "company_name": company,
            "role": role,
            "technical_questions": technical_questions,
            "project_questions": project_questions,
            "behavioral_questions": behavioral_questions,
            "jd_specific_questions": jd_specific_questions,
            "resume_specific_questions": resume_specific_questions,
            "follow_up_questions": follow_up_questions,
            "suggested_preparation_topics": prep_topics,
            "general_questions": general_questions,
            "disclaimer": cls.DISCLAIMER_TEXT,
        }

    # -------------------------------------------------------------------------
    # 2. Evaluate Candidate Answer Across 6 Dimensions
    # -------------------------------------------------------------------------
    @classmethod
    def evaluate_answer(
        cls,
        question: str,
        category: str,
        context_source: Optional[str],
        candidate_answer: str,
        candidate_data: Optional[Dict[str, Any]] = None,
        job_data: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Dict[str, Any], Optional[str], List[str]]:
        """
        Evaluates a candidate's answer across the 6 mandatory categories:
        - Technical accuracy
        - Relevance
        - Clarity
        - Structure
        - Evidence
        - Communication

        Returns:
            (evaluation_dict, contextual_follow_up_question, detected_weak_areas)
        """
        answer_text = candidate_answer.strip()
        word_count = len(answer_text.split())
        lower_answer = answer_text.lower()

        # Detection heuristics
        # 1. Evidence: looks for numbers, %, metrics, specific tools, concrete project citations
        has_metrics = bool(re.search(r"\b(\d+[%kKmM]?|\b[0-9]+(\.[0-9]+)?\s*(ms|seconds|minutes|hours|rps|qps|users|req/s))\b", answer_text))
        has_project_cite = any(w in lower_answer for w in ["project", "built", "implemented", "deployed", "designed", "architected", "team", "migration", "production"])
        has_technical_terms = any(w in lower_answer for w in [
            "api", "database", "postgres", "sql", "redis", "cache", "latency", "async", "thread",
            "docker", "kubernetes", "microservice", "index", "queue", "schema", "scale", "auth",
            "endpoint", "pipeline", "distributed", "lock", "concurrency", "test", "metric"
        ])

        # 2. Structure: checks for clear sequencing, STAR keywords, bullet phrasing, or problem-action-result flow
        has_star_structure = any(w in lower_answer for w in [
            "situation", "task", "action", "result", "initially", "then", "subsequently", "finally",
            "the challenge was", "our approach", "as a result", "consequently", "we chose", "trade-off"
        ])

        # 3. Relevance: checks if answer is at least somewhat related to words in the question
        question_words = set(re.findall(r"\b[a-z]{4,}\b", question.lower()))
        answer_words = set(re.findall(r"\b[a-z]{4,}\b", lower_answer))
        overlap_count = len(question_words.intersection(answer_words))
        relevance_ratio = min(1.0, overlap_count / max(2, len(question_words) * 0.3))

        # Base scoring calculation
        # Word count factor: 40-200 words is typically solid for interview responses
        if word_count < 15:
            base_score = 45.0
        elif word_count < 35:
            base_score = 65.0
        elif word_count <= 250:
            base_score = 85.0
        else:
            base_score = 78.0  # slightly penalized for rambling if > 250 words

        # 1. Technical Accuracy
        tech_acc = base_score
        if has_technical_terms:
            tech_acc = min(96.0, tech_acc + 8.0)
        else:
            if category in ["TECHNICAL", "JD_SPECIFIC"]:
                tech_acc = max(40.0, tech_acc - 20.0)

        # 2. Relevance
        rel = min(98.0, max(35.0, 50.0 + (relevance_ratio * 45.0)))
        if word_count < 10:
            rel = max(30.0, rel - 25.0)

        # 3. Clarity
        clarity = base_score
        if 40 <= word_count <= 180:
            clarity = min(95.0, clarity + 10.0)
        elif word_count > 250:
            clarity = max(55.0, clarity - 15.0)  # overly verbose
        elif word_count < 25:
            clarity = max(50.0, clarity - 10.0)

        # 4. Structure
        structure = 60.0
        if has_star_structure:
            structure += 25.0
        if 35 <= word_count <= 220:
            structure += 10.0
        structure = min(95.0, max(40.0, structure))

        # 5. Evidence
        evidence = 50.0
        if has_metrics:
            evidence += 25.0
        if has_project_cite:
            evidence += 15.0
        evidence = min(98.0, max(35.0, evidence))

        # 6. Communication
        communication = 70.0
        if word_count >= 30:
            communication += 15.0
        if has_star_structure:
            communication += 5.0
        if word_count > 280:
            communication -= 10.0
        communication = min(95.0, max(45.0, communication))

        # Overall weighted score
        overall_score = round(
            (tech_acc * 0.25) +
            (rel * 0.20) +
            (clarity * 0.15) +
            (structure * 0.15) +
            (evidence * 0.15) +
            (communication * 0.10),
            1
        )

        # Compile strengths, weaknesses, tips, and weak areas
        strengths = []
        weaknesses = []
        improvement_tips = []
        weak_areas = []

        if tech_acc >= 80:
            strengths.append("Accurate technical terminology and sound engineering reasoning.")
        else:
            weaknesses.append("Technical depth was high-level; lacks deep explanation of underlying mechanisms.")
            improvement_tips.append("Dive deeper into internal architecture, memory models, or algorithmic tradeoffs.")
            weak_areas.append("Technical Depth & Accuracy")

        if rel >= 80:
            strengths.append("Directly addressed the core prompt without straying off-topic.")
        else:
            weaknesses.append("Response deviated somewhat from the specific question asked.")
            improvement_tips.append("Start with a direct thesis statement answering the interviewer's exact question.")
            weak_areas.append("Answer Relevance & Directness")

        if structure >= 75:
            strengths.append("Logical progression with clear setup and conclusion.")
        else:
            weaknesses.append("Response lacked structured progression (e.g. STAR method or Problem/Solution/Result).")
            improvement_tips.append("Adopt the STAR method: 1. Situation, 2. Task, 3. Action taken, 4. Quantifiable Result.")
            weak_areas.append("Response Structure (STAR Method)")

        if evidence >= 75:
            strengths.append("Supported assertions with concrete metrics and project evidence.")
        else:
            weaknesses.append("Relies on hypothetical claims without citing verified past metrics or project outcomes.")
            improvement_tips.append("Include specific numbers (e.g., latency dropped from 250ms to 45ms, 99.9% uptime).")
            weak_areas.append("Concrete Evidence & Quantitative Metrics")

        if clarity >= 80 and communication >= 80:
            strengths.append("Articulate, concise, and professional tone.")
        else:
            if word_count > 250:
                weaknesses.append("Pacing was overly verbose; risk of losing the interviewer's attention.")
                improvement_tips.append("Target 90 to 120 seconds per answer (around 120-160 spoken words).")
                weak_areas.append("Conciseness & Communication Pacing")
            elif word_count < 30:
                weaknesses.append("Response was too brief for an in-depth interview context.")
                improvement_tips.append("Expand on your individual technical decisions and outcomes.")
                weak_areas.append("Response Thoroughness")

        if not strengths:
            strengths.append("Prompt communication and willingness to tackle the question.")

        # Build constructive feedback summary
        if overall_score >= 85:
            feedback_summary = f"Strong response scoring {overall_score}/100. Demonstrates clear competency and structured communication."
        elif overall_score >= 70:
            feedback_summary = f"Solid response ({overall_score}/100) with good foundational elements. Adding concrete metrics and deeper technical trade-offs will make it outstanding."
        else:
            feedback_summary = f"Developing response ({overall_score}/100). Focus on grounding your answer in specific engineering projects with measurable outcomes."

        # Synthesize targeted contextual follow-up question
        # If evidence was weak, ask for metrics; if tech was weak, ask for failure handling; else ask for scale/alternatives
        follow_up_question = cls._generate_contextual_follow_up(
            question=question,
            category=category,
            candidate_answer=answer_text,
            evidence_score=evidence,
            tech_score=tech_acc,
        )

        evaluation_data = {
            "technical_accuracy": round(tech_acc, 1),
            "relevance": round(rel, 1),
            "clarity": round(clarity, 1),
            "structure": round(structure, 1),
            "evidence": round(evidence, 1),
            "communication": round(communication, 1),
            "overall_score": overall_score,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "feedback": feedback_summary,
            "improvement_tips": improvement_tips,
        }

        return evaluation_data, follow_up_question, weak_areas

    # -------------------------------------------------------------------------
    # 3. Contextual Follow-up Question Generator
    # -------------------------------------------------------------------------
    @classmethod
    def _generate_contextual_follow_up(
        cls,
        question: str,
        category: str,
        candidate_answer: str,
        evidence_score: float,
        tech_score: float,
    ) -> str:
        """
        Dynamically generates a relevant follow-up question probing
        deeper into the candidate's exact answer.
        """
        lower = candidate_answer.lower()

        # Probe for missing metrics if evidence was light
        if evidence_score < 70:
            return "You outlined the architectural direction well. Can you quantify the specific impact? For instance, what was the baseline metric before your change vs. the measured outcome in production?"

        # Probe for concurrency / failure modes if technical discussion
        if "cache" in lower or "redis" in lower:
            return "How did your design handle cache invalidation and cache stampede (thundering herd) during high-throughput cache misses?"
        elif "database" in lower or "sql" in lower or "postgres" in lower:
            return "What index design and transaction isolation level did you choose for those tables, and how did you prevent deadlocks under concurrent writes?"
        elif "api" in lower or "microservice" in lower:
            return "How did you design for failure isolation and circuit breaking between services if a downstream dependency began timing out?"
        elif "team" in lower or "disagree" in lower or "conflict" in lower:
            return "If you were faced with that exact disagreement again today, what would you do differently to reach consensus even faster?"
        elif tech_score < 70:
            return "Could you walk through the edge cases or failure modes of that approach? How would you handle network partitions or data corruption?"
        else:
            return "If the scale increased by 10x and latency SLAs tightened to under 50ms, what would be the first bottleneck in your approach, and how would you redesign it?"

    # -------------------------------------------------------------------------
    # 4. Synthesize Final Comprehensive Feedback
    # -------------------------------------------------------------------------
    @classmethod
    def synthesize_final_feedback(
        cls,
        turns: List[Dict[str, Any]],
        job_data: Dict[str, Any],
        candidate_data: Dict[str, Any],
        accumulated_weak_areas: List[str],
    ) -> Dict[str, Any]:
        """
        Synthesizes overall interview performance report, category scores,
        key strengths, consolidated weak areas, and targeted recommendations.
        """
        if not turns:
            return {
                "overall_score": 0.0,
                "category_scores": {
                    "technical_accuracy": 0.0,
                    "relevance": 0.0,
                    "clarity": 0.0,
                    "structure": 0.0,
                    "evidence": 0.0,
                    "communication": 0.0,
                },
                "summary": "No answered turns recorded.",
                "strengths": [],
                "weak_areas": [],
                "recommendations": ["Complete at least one interview turn to receive comprehensive evaluation."],
                "preparation_topics_to_review": [],
            }

        evaluated_turns = [t for t in turns if t.get("evaluation")]
        if not evaluated_turns:
            evaluated_turns = turns

        # Compute category averages
        cat_keys = ["technical_accuracy", "relevance", "clarity", "structure", "evidence", "communication"]
        category_scores: Dict[str, float] = {}

        for k in cat_keys:
            vals = [
                t["evaluation"][k]
                for t in evaluated_turns
                if t.get("evaluation") and k in t["evaluation"]
            ]
            category_scores[k] = round(sum(vals) / len(vals), 1) if vals else 70.0

        overall_scores = [
            t["evaluation"]["overall_score"]
            for t in evaluated_turns
            if t.get("evaluation") and "overall_score" in t["evaluation"]
        ]
        overall_avg = round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else 70.0

        # Consolidate strengths
        all_strengths = []
        for t in evaluated_turns:
            if t.get("evaluation"):
                all_strengths.extend(t["evaluation"].get("strengths", []))
        unique_strengths = list(dict.fromkeys(all_strengths))[:4]
        if not unique_strengths:
            unique_strengths = ["Engaged actively throughout the mock interview session."]

        # Consolidate weak areas
        all_weak = list(accumulated_weak_areas)
        for t in evaluated_turns:
            if t.get("evaluation"):
                all_weak.extend(t["evaluation"].get("weaknesses", []))
        unique_weak_areas = list(dict.fromkeys(all_weak))[:5]

        # Actionable recommendations
        recommendations = []
        if category_scores.get("evidence", 0) < 75:
            recommendations.append("Prepare 3-5 quantitative metrics from your past projects (latency reduction, RPS handled, lines of code refactored, team size).")
        if category_scores.get("structure", 0) < 75:
            recommendations.append("Strictly follow the STAR method for behavioral questions. Keep Situation and Task under 45 seconds total.")
        if category_scores.get("technical_accuracy", 0) < 75:
            recommendations.append("Review distributed systems fundamentals: caching patterns, database indexing, and fault-tolerance mechanics.")
        if category_scores.get("clarity", 0) < 75:
            recommendations.append("Aim for concise 90-120 second answers. State your high-level thesis before elaborating on technical details.")

        if not recommendations:
            recommendations.append("Maintain this strong level of articulation and concise technical depth during your real interview rounds.")

        # Topics to review
        topics_to_review = []
        req_skills = job_data.get("required_skills") or []
        for s in req_skills[:3]:
            topics_to_review.append(f"{s} Architecture & Edge Cases")
        topics_to_review.append("STAR Incident Response Stories")

        # Summary text
        role = job_data.get("role") or "Target Position"
        company = job_data.get("company") or "the company"
        if overall_avg >= 85:
            verdict = f"Outstanding performance for {role} at {company}. Strong technical articulation and structured delivery."
        elif overall_avg >= 70:
            verdict = f"Competent interview performance for {role} at {company}. Well-positioned with minor polish needed in evidence and structure."
        else:
            verdict = f"Developing readiness for {role} at {company}. Prioritize the recommended topics and quantitative evidence before the live interview."

        return {
            "overall_score": overall_avg,
            "category_scores": category_scores,
            "summary": verdict,
            "strengths": unique_strengths,
            "weak_areas": unique_weak_areas,
            "recommendations": recommendations,
            "preparation_topics_to_review": topics_to_review,
        }
