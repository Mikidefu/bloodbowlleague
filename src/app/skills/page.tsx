'use client';
import { useState, useEffect } from 'react';
import { Book, ChevronDown, Search } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import styles from './Skills.module.css';
import type { Skill } from '@/lib/types';

export default function SkillsPage() {
    const { language } = useLanguage();
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // --- FILTRO CATEGORIA (null = tutte) ---
    const [activeType, setActiveType] = useState<string | null>(null);

    // --- AUTOCOMPLETE STATE ---
    const [searchInput, setSearchInput] = useState('');
    const [suggestions, setSuggestions] = useState<Skill[]>([]);

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
        setActiveType(null); // Mostra tutte le categorie così la skill è visibile
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

    if (loading) return <div className="loading-state">Consulting the Playbook...</div>;

    // Raggruppiamo le skill per tipo
    const groupedSkills = skills.reduce((acc: Record<string, Skill[]>, skill) => {
        if (!acc[skill.type]) acc[skill.type] = [];
        acc[skill.type].push(skill);
        return acc;
    }, {});

    const skillTypes = Object.keys(groupedSkills);
    const visibleTypes = activeType ? skillTypes.filter(type => type === activeType) : skillTypes;

    const toggleSkill = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className={styles.page}>

            <PageHeader title="SKILLS & ABILITIES" icon={<Book size={44} />} tone="navy" />

            {/* BARRA DI RICERCA AUTOCOMPLETE + FILTRI (striscia scura smussata) */}
            <section className={styles.toolbar}>
                <div className={styles.toolbarMicro} aria-hidden="true">
                    <span><i className={styles.microSquares} />{`Playbook // Search`}</span>
                    <span className={styles.toolbarCount}>{`${skills.length} skills // ${skillTypes.length} types`}</span>
                </div>

                <div className={styles.searchContainer}>
                    <label htmlFor="skill-search" className={styles.searchLabel}>QUICK SEARCH PLAYBOOK</label>
                    <div className={styles.searchField}>
                        <Search size={22} className={styles.searchIcon} aria-hidden="true" />
                        <input
                            id="skill-search"
                            type="text"
                            value={searchInput}
                            onChange={e => handleSearchChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={styles.searchInput}
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

                {/* FILTRI CATEGORIA */}
                {skillTypes.length > 1 && (
                    <div className={styles.filters} role="group" aria-label="Skill categories">
                        <button
                            type="button"
                            className={`btn ${activeType === null ? 'btn-primary' : 'btn-slate'} ${styles.filterBtn}`}
                            aria-pressed={activeType === null}
                            onClick={() => setActiveType(null)}
                        >
                            <span>ALL</span>
                        </button>
                        {skillTypes.map(type => (
                            <button
                                key={type}
                                type="button"
                                className={`btn ${activeType === type ? 'btn-primary' : 'btn-slate'} ${styles.filterBtn}`}
                                aria-pressed={activeType === type}
                                onClick={() => setActiveType(activeType === type ? null : type)}
                            >
                                <span>
                                    {type} <small className={styles.filterCount}>{groupedSkills[type].length}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* CICLO DELLE CATEGORIE: fasce alternate chiare e scure */}
            {visibleTypes.map((type, i) => {
                const index = String(skillTypes.indexOf(type) + 1).padStart(2, '0');
                const light = i % 2 === 0;
                const ghostWord = type.split(' ')[0];

                return (
                    <section
                        key={type}
                        className={`bleed ${styles.categoryBand} ${light ? styles.bandLight : styles.bandDark}`}
                    >
                        <span className={`ghost-text ${light ? 'on-light' : ''} ${styles.ghostCategory}`} aria-hidden="true">{ghostWord}</span>

                        <div className={styles.inner}>
                            <SectionTitle
                                index={index}
                                on={light ? 'light' : 'dark'}
                                micro={`${groupedSkills[type].length} skills // Playbook`}
                                title={type}
                            />

                            {/* LISTA SKILL */}
                            <div className={styles.skillsList}>
                                {groupedSkills[type].map(skill => {
                                    const isExpanded = expandedId === skill.id;

                                    return (
                                        <article
                                            id={`skill-${skill.id}`} // Ancora HTML per l'autoscroll
                                            key={skill.id}
                                            className={`chamfer ${styles.skillEntry} ${isExpanded ? styles.expanded : ''}`}
                                        >
                                            {/* INTESTAZIONE CLICCABILE */}
                                            <h3 className={styles.skillHeading}>
                                                <button
                                                    type="button"
                                                    className={styles.skillHeader}
                                                    onClick={() => toggleSkill(skill.id)}
                                                    aria-expanded={isExpanded}
                                                >
                                                    <span className={styles.skillNameWrapper}>
                                                        <span className={styles.skillName}>
                                                            {skill.name}
                                                        </span>
                                                        {skill.level && (
                                                            <span className={styles.skillLevel}>
                                                                ({skill.level})
                                                            </span>
                                                        )}
                                                    </span>

                                                    <span className={styles.iconWrapper} aria-hidden="true">
                                                        <ChevronDown size={24} />
                                                    </span>
                                                </button>
                                            </h3>

                                            {/* CONTENUTO ESPANSO */}
                                            {isExpanded && (
                                                <div className={styles.skillContent}>
                                                    <p className={styles.description}>
                                                        {language === 'it' && skill.description_it ? skill.description_it : skill.description}
                                                    </p>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
