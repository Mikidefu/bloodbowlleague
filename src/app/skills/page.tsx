'use client';
import { useState, useEffect } from 'react';
import { Book, ChevronDown, Search } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Skills.module.css';

export default function SkillsPage() {
    const { language } = useLanguage();
    const [skills, setSkills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // --- AUTOCOMPLETE STATE ---
    const [searchInput, setSearchInput] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/skills')
            .then(res => res.json())
            .then(data => {
                setSkills(data);
                setLoading(false);

                // Autoscroll & Auto-expand tramite URL (mantenuto)
                if (typeof window !== 'undefined') {
                    const params = new URLSearchParams(window.location.search);
                    const skillId = params.get('expandedId');
                    if (skillId) {
                        setExpandedId(skillId);
                        setTimeout(() => {
                            const el = document.getElementById(`skill-${skillId}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 300);
                    }
                }
            });
    }, []);

    // --- LOGICA AUTOCOMPLETE ---
    const handleSearchChange = (value: string) => {
        setSearchInput(value);
        if (value.trim() === '') {
            setSuggestions([]);
            return;
        }

        // Filtra ignorando le maiuscole/minuscole
        const filtered = skills.filter(skill =>
            skill.name.toLowerCase().includes(value.toLowerCase())
        );
        setSuggestions(filtered);
    };

    const handleSelectSuggestion = (skillId: string) => {
        setSearchInput('');
        setSuggestions([]);
        setExpandedId(skillId); // Espande l'abilità

        // Scorri dolcemente fino all'elemento
        setTimeout(() => {
            const el = document.getElementById(`skill-${skillId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && suggestions.length > 0) {
            e.preventDefault();
            handleSelectSuggestion(suggestions[0].id); // Seleziona il primo se premi invio
        }
    };
    // ---------------------------

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

            {/* BARRA DI RICERCA AUTOCOMPLETE */}
            <div className={styles.searchContainer}>
                <label className={styles.searchLabel}>QUICK SEARCH PLAYBOOK</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={28} color="var(--color-ink)" style={{ position: 'absolute', left: '15px' }} />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={e => handleSearchChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={styles.searchInput}
                        style={{ paddingLeft: '55px' }}
                        placeholder="Type a skill name..."
                        autoComplete="off"
                    />
                </div>

                {/* TENDINA SUGGERIMENTI */}
                {suggestions.length > 0 && (
                    <ul className={styles.suggestionsList}>
                        {suggestions.map(skill => (
                            <li
                                key={skill.id}
                                className={styles.suggestionItem}
                                onClick={() => handleSelectSuggestion(skill.id)}
                            >
                                <span className={styles.suggestionName}>
                                    {skill.name.charAt(0).toUpperCase() + skill.name.slice(1).toLowerCase()}
                                </span>
                                <span className={styles.suggestionType}>{skill.type}</span>
                            </li>
                        ))}
                    </ul>
                )}
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
                                    id={`skill-${skill.id}`} // Ancora HTML per l'autoscroll
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