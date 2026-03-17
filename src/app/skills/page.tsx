'use client';
import { useState, useEffect } from 'react';
import { Book, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function SkillsPage() {
    const { language, t } = useLanguage();
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

    if (loading) return <div className="p-8">Consultando il regolamento...</div>;

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
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '3rem', marginBottom: '2rem', borderBottom: '2px solid var(--color-blood-red)', paddingBottom: '1rem' }}>
                <Book size={40} color="var(--color-blood-bright)" />
                SKILLS & ABILITIES
            </h1>

            {Object.keys(groupedSkills).map(type => (
                <div key={type} style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{
                        color: 'var(--color-gold)',
                        fontSize: '1.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '1rem',
                        paddingLeft: '0.5rem',
                        borderLeft: '4px solid var(--color-gold)'
                    }}>
                        {type}
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {groupedSkills[type].map((skill: any) => (
                            <div
                                key={skill.id}
                                className="card"
                                style={{
                                    padding: '0',
                                    overflow: 'hidden',
                                    borderColor: expandedId === skill.id ? 'var(--color-blood-red)' : 'var(--color-glass-border)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div
                                    onClick={() => toggleSkill(skill.id)}
                                    style={{
                                        padding: '1rem 1.5rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        background: expandedId === skill.id ? 'rgba(139, 0, 0, 0.1)' : 'transparent'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-bone)' }}>
                      {skill.name} {skill.level ? `(${skill.level})` : ''}
                    </span>
                                    </div>
                                    {expandedId === skill.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>

                                {expandedId === skill.id && (
                                    <div style={{
                                        padding: '1.5rem',
                                        background: 'rgba(0,0,0,0.3)',
                                        borderTop: '1px solid var(--color-glass-border)',
                                        lineHeight: '1.6',
                                        color: 'var(--color-steel-light)'
                                    }}>
                                        // Trova questa riga dentro il blocco del toggle:
                                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                            {language === 'it' && skill.description_it ? skill.description_it : skill.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}