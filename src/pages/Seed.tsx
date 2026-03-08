import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Seed() {
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const foods = [
      { id: 'test-chicken', name: 'Chicken Breast', servingSize: 100, servingUnit: 'g', nutrients: { 'energy-kcal': 165, fat: 3.6, proteins: 31, carbohydrates: 0, fiber: 0, 'saturated-fat': 1, sugars: 0, sodium: 74 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'test-rice', name: 'Brown Rice', servingSize: 100, servingUnit: 'g', nutrients: { 'energy-kcal': 112, fat: 0.9, proteins: 2.6, carbohydrates: 24, fiber: 1.8, sugars: 0.4, 'saturated-fat': 0.2, sodium: 1 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'test-banana', name: 'Banana', servingSize: 100, servingUnit: 'g', nutrients: { 'energy-kcal': 89, fat: 0.3, proteins: 1.1, carbohydrates: 23, fiber: 2.6, sugars: 12, 'saturated-fat': 0.1, potassium: 358, 'vitamin-c': 8.7 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'test-eggs', name: 'Eggs', servingSize: 100, servingUnit: 'g', nutrients: { 'energy-kcal': 155, fat: 11, proteins: 13, carbohydrates: 1.1, 'saturated-fat': 3.3, cholesterol: 373, sodium: 124 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];

    localStorage.setItem('nutrient-tracker-foods', JSON.stringify(foods));

    const logs = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];
      const entries: any[] = [];
      entries.push({ id: crypto.randomUUID(), foodId: 'test-chicken', servingAmount: 1 + Math.random(), timestamp: d.toISOString() });
      entries.push({ id: crypto.randomUUID(), foodId: 'test-rice', servingAmount: 1.5 + Math.random(), timestamp: d.toISOString() });
      if (i % 2 === 0) entries.push({ id: crypto.randomUUID(), foodId: 'test-banana', servingAmount: 1, timestamp: d.toISOString() });
      if (i % 3 === 0) entries.push({ id: crypto.randomUUID(), foodId: 'test-eggs', servingAmount: 1, timestamp: d.toISOString() });
      logs.push({ id: crypto.randomUUID(), date, entries });
    }

    localStorage.setItem('nutrient-tracker-logs', JSON.stringify(logs));
    setDone(true);
    setTimeout(() => navigate('/'), 1000);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-background text-foreground">
      <p>{done ? '✅ Test data seeded! Redirecting...' : 'Seeding test data...'}</p>
    </div>
  );
}
