'use client';
import { useState, useEffect } from 'react';
import { Book, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Skills.module.css';

export default function SkillsPage() {
    const { language } = useLanguage();
    const [skills, setSkills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/skills')
            .then(res => res.json())
            .then(data => {
                setSkills(data);
                setLoading(false);
            });
    }, []);

    if (loading) return <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.5rem', textAlign: 'center', marginTop: '4rem' }}>Consulting the Playbook...</div>;

    // Raggruppiamo le skill per tipo
    const groupedSkills = skills.reduce((acc: any, skill) => {
        if (!acc[skill.type]) acc[skill.type] = [];
        acc[skill.type].push(skill);
        return acc;
    }, {});

    const toggleSkill = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>

            {/* HEADER */}
            <div className={styles.headerArea}>
                <Book size={48} color="var(--color-blood-bright)" />
                <h1 className={styles.pageTitle}>SKILLS & ABILITIES</h1>
            </div>

            {/* CICLO DELLE CATEGORIE */}
            {Object.keys(groupedSkills).map(type => (
                <div key={type} className={styles.categoryBlock}>

                    {/* TITOLO CATEGORIA (Effetto Nastro) */}
                    <div className={styles.categoryTitleWrapper}>
                        <div className={styles.categoryTitle}>
                            <span>{type}</span>
                        </div>
                    </div>

                    {/* LISTA SKILL */}
                    <div className={styles.skillsList}>
                        {groupedSkills[type].map((skill: any) => {
                            const isExpanded = expandedId === skill.id;

                            return (
                                <div
                                    key={skill.id}
                                    className={`${styles.skillCard} ${isExpanded ? styles.expanded : ''}`}
                                >
                                    {/* INTESTAZIONE CLICCABILE */}
                                    <div
                                        className={styles.skillHeader}
                                        onClick={() => toggleSkill(skill.id)}
                                    >
                                        <div className={styles.skillNameWrapper}>
                                            <h3 className={styles.skillName}>
                                                {skill.name}
                                            </h3>
                                            {skill.level && (
                                                <span className={styles.skillLevel}>
                                                    ({skill.level})
                                                </span>
                                            )}
                                        </div>

                                        <div className={styles.iconWrapper}>
                                            <ChevronDown size={28} />
                                        </div>
                                    </div>

                                    {/* CONTENUTO ESPANSO (Macchina da scrivere su griglia) */}
                                    {isExpanded && (
                                        <div className={styles.skillContent}>
                                            <p className={styles.description}>
                                                {language === 'it' && skill.description_it ? skill.description_it : skill.description}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}