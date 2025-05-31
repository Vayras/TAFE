import React, { useEffect, useState, useMemo, useCallback} from 'react';


interface ApiStudentEntry {
  name: string;
  mail?: string; // Matches 'email' in frontend
  group_id: string; // Matches 'group' in frontend
  ta?: string;
  attendance?: string; // 'yes' or 'no'
  fa?: number;
  fb?: number;
  fc?: number;
  fd?: number;
  bonus_attempt?: number; // 'yes' or 'no'
  bonus_answer_quality?: number; // 'yes' or 'no'
  bonus_follow_up?: number; // 'yes' or 'no'
  exercise_submitted?: string; // 'yes' or 'no'
  exercise_test_passing?: string; // 'yes' or 'no'
  exercise_good_documentation?: string; // 'yes' or 'no'
  exercise_good_structure?: string; // 'yes' or 'no'
  week: number;
  total?: number; // Backend might also send total, or frontend calculates
}

// Table row data shape (assuming this is unchanged)
interface TableRowData {
  id: number;
  name: string;
  email?: string;
  group: string;
  ta: string;
  attendance: boolean;
  gdScore: { fa: number; fb: number; fc: number; fd: number };
  bonusScore: { attempt: number; good: number; followUp: number };
  exerciseScore: { Submitted: boolean; privateTest: boolean; goodStructure: boolean; goodDoc: boolean };
  week?: number;
  total: number;
}

const TableView: React.FC = () => {
  const [data, setData] = useState<TableRowData[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [week, setWeek] = useState(0);
  
  const baseGroups = useMemo(() => ['Group 1', 'Group 2', 'Group 3', 'Group 4'], []); // Static list of groups
  const canEditFields = isEditing && week !== 0;

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof TableRowData | null; direction: 'ascending' | 'descending' }>({
    key: null,
    direction: 'ascending',
  });

  // --- New states for dropdown filters ---
  const [selectedGroup, setSelectedGroup] = useState<string>('All Groups');
  const [selectedTA, setSelectedTA] = useState<string>('All TAs');
  // --- End of new states ---

  // Scoring formulas (assuming these are unchanged)
const computeGdTotal = (gd: TableRowData['gdScore']): number =>
  (30 / 5) * gd.fa + (30 / 5) * gd.fb + (20 / 5) * gd.fc + (20 / 5) * gd.fd;

const computeBonusTotal = (b: TableRowData['bonusScore']): number =>
 (10 / 5) * b.attempt + (10 / 5) * b.good + (10 / 5) * b.followUp;

const computeExerciseTotal = (e: TableRowData['exerciseScore']): number =>
  (e.Submitted ? 10 : 0) +
  (e.privateTest ? 50 : 0) +
  (e.goodDoc ? 20 : 0) +
  (e.goodStructure ? 20 : 0);

const computeTotal = (p: TableRowData): number =>
  computeGdTotal(p.gdScore) +
  computeBonusTotal(p.bonusScore) +
  computeExerciseTotal(p.exerciseScore);

  
   const fetchWeeklyData = useCallback((selectedWeek: number) => {
    // Update the active week
    fetch(`http://localhost:8080/weekly_data/${selectedWeek}`)
      .then(response => {
        if (!response.ok) {
          // If response not ok, try to parse error message from backend if available
          return response.text().then(text => { 
            let errorDetail = text;
            try {
                const jsonError = JSON.parse(text);
                errorDetail = jsonError.message || text;
            } catch (e) { /* ignore parsing error, use raw text */ }
            throw new Error(`Server error: ${response.status} - ${errorDetail}`);
          });
        }
        return response.json();
      })
      .then((apiData: ApiStudentEntry[]) => {
        const formattedData = apiData.map((person, index) => {
          const gdScore = {
            fa: person.fa || 0,
            fb: person.fb || 0,
            fc: person.fc || 0,
            fd: person.fd || 0,
          };
          const bonusScore = {
            attempt: person.bonus_attempt || 0,
            good: person.bonus_answer_quality || 0,
            followUp: person.bonus_follow_up || 0,
          };
          const exerciseScore = {
            Submitted: person.exercise_submitted === 'yes',
            privateTest: person.exercise_test_passing === 'yes',
            goodStructure: person.exercise_good_structure === 'yes',
            goodDoc: person.exercise_good_documentation === 'yes',
          };
          
          const rowData: TableRowData = {
            id: index + 1, // Using index as a fallback key; consider unique ID from backend if available
            name: person.name,
            email: person.mail,
            group: person.group_id,
            ta: person.ta || 'N/A',
            attendance: person.attendance === 'yes',
            gdScore,
            bonusScore,
            exerciseScore,
            week: selectedWeek, // Ensure data is tagged with the week it was fetched for
            total: 0, // Placeholder, will be computed
          };
          rowData.total = computeTotal(rowData); // Compute total after all scores are structured
          return rowData;
        });
        console.log(`Fetched data for week ${selectedWeek}:`, formattedData);
        setData(formattedData);
      })
      .catch(error => {
        console.error(`Error fetching data for week ${selectedWeek}:`, error);
        setData([]); // Clear data on error
      });
  }, [computeTotal]); // Added computeTotal to dependencies

useEffect(() => {
  fetchWeeklyData(0);
}, []); 

  
const [totalCount, setTotalCount] = useState<number | null>(null);
  useEffect(() => {
    fetch("http://localhost:8080/students/count")
      .then(res => res.json())
      .then(data => {
        setTotalCount(data.total_students);
      })
      .catch(err => console.error("Error fetching total count:", err));
  }, []);




  // --- Dynamic options for TA filter dropdown ---
  const taOptions = useMemo(() => {
    if (!data || data.length === 0) return ['All TAs'];
    const uniqueTAs = new Set(data.map(person => person.ta).filter(ta => ta && ta !== 'N/A'));
    return ['All TAs', ...Array.from(uniqueTAs).sort()];
  }, [data]);
  // ---

  const processedData = useMemo(() => {
    let D_filteredData = [...data];

    // Apply Group filter
    if (selectedGroup !== 'All Groups') {
      D_filteredData = D_filteredData.filter(person => person.group === selectedGroup);
    }

    // Apply TA filter
    if (selectedTA !== 'All TAs') {
      D_filteredData = D_filteredData.filter(person => person.ta === selectedTA);
    }

    // Apply search filter (on name)
    if (searchTerm) {
      D_filteredData = D_filteredData.filter(person =>
        person.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting (primarily for 'name' or other header-sortable columns)
    if (sortConfig.key) {
      D_filteredData.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          if (aValue.toLowerCase() < bValue.toLowerCase()) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (aValue.toLowerCase() > bValue.toLowerCase()) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
        }
        return 0;
      });
    }
    return D_filteredData;
  }, [data, searchTerm, sortConfig, selectedGroup, selectedTA]);

  const requestSort = (key: keyof TableRowData) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleClear = () => {
    setSearchTerm('');
    setSelectedGroup('All Groups');
    setSelectedTA('All TAs');
  };
  const handleGdScoreChange = (id: number, key: keyof TableRowData['gdScore'], v: string) =>
    setData(d => d.map(p => p.id === id ? { ...p, gdScore: { ...p.gdScore, [key]: parseInt(v) || 0 } } : p));
  const handleBonusScoreChange = (id: number, key: keyof TableRowData['bonusScore'], v: string) =>
    setData(d => d.map(p => p.id === id ? { ...p, bonusScore: { ...p.bonusScore, [key]: parseInt(v) || 0 } } : p));
  const handleExerciseScoreChange = (id: number, key: keyof TableRowData['exerciseScore']) =>
    setData(d => d.map(p => p.id === id ? { ...p, exerciseScore: { ...p.exerciseScore, [key]: !p.exerciseScore[key] } } : p));

  const handleEdit = () => setIsEditing(true);

  type WeeklyAttendance = {
  week: number;
  attended: number;
};

   const [weeklyData, setWeeklyData] = useState<WeeklyAttendance[]>([]);
     useEffect(() => {
    fetch("http://localhost:8080/attendance/weekly_counts")
      .then(res => res.json())
      .then(data => setWeeklyData(data))
      .catch(err => console.error("Error fetching weekly attendance:", err));
  }, []);
  
  const handleSave = () => { // Saves based on the 'data' state, which is unfiltered and unsorted

    const payload = data.map(p => ({
      name: p.name, mail: p.email, attendance: p.attendance ? 'yes' : 'no', week:week,
      group_id: p.group, ta: p.ta, fa: p.gdScore.fa, fb: p.gdScore.fb, fc: p.gdScore.fc, fd: p.gdScore.fd,
      bonus_attempt: p.bonusScore.attempt, bonus_answer_quality: p.bonusScore.good,
      bonus_follow_up: p.bonusScore.followUp, exercise_submitted: p.exerciseScore.Submitted ? 'yes' : 'no',
      exercise_test_passing: p.exerciseScore.privateTest ? 'yes' : 'no', exercise_good_documentation: p.exerciseScore.goodDoc ? 'yes' : 'no',
      exercise_good_structure: p.exerciseScore.goodStructure ? 'yes' : 'no', total: computeTotal(p)
    }));
    console.log('Saving data for week', week, payload);
    fetch(`http://localhost:8080/weekly_data/${week}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(r => {
      console.log('Save response:', r);
      if (!r.ok) throw new Error(r.statusText);
      setIsEditing(false);
      return r.json();
    })
    .catch(e => console.error('Save failed', e));
};


  const getSortIndicator = (key: keyof TableRowData) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
    }
    return '';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-full mx-auto">
        <h1>Cohort Name</h1>
        <h2 className='font-light'>End Date - Start Date</h2>
        <h2 className='font-light'>Github Classroom Master Repository</h2>
        <h3 className="">Cohort Participants</h3>

        <div className='flex gap-4 mb-4 items-center'>
           {[0].map(i => (
            <button key={i} onClick={() => { setWeek(i); fetchWeeklyData(i); }}
              className={`font-light text-xl pb-1 ${week === i ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-indigo-500'}`}>
              Week {i}
            </button>
          ))}
          {[1, 2, 3, 4].map(i => (
            <button key={i} onClick={() => { setWeek(i); fetchWeeklyData(i); }}
              className={`font-light text-xl pb-1 ${week === i ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-indigo-500'}`}>
              Week {i}
            </button>
          ))}
        </div>

     

        {/* --- Filter Controls --- */}
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 flex-grow sm:flex-grow-0 sm:w-auto"
          />
          <div>
            <label htmlFor="groupFilter" className="sr-only">Filter by Group</label>
            <select
              id="groupFilter"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {['All Groups', ...baseGroups].map(groupName => (
                <option key={groupName} value={groupName}>{groupName}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="taFilter" className="sr-only">Filter by TA</label>
            <select
              id="taFilter"
              value={selectedTA}
              onChange={(e) => setSelectedTA(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {taOptions.map(taName => (
                <option key={taName} value={taName}>{taName}</option>
              ))}
            </select>
          </div>
          <div>
          <button onClick={() => handleClear()} >clear filters</button>
        </div>
        </div>

        <div className="flex justify-end gap-2 mb-4 justify-between items-center mt-8">
          <div className='flex gap-8 text-2xl '>
            <div>
              Total Participants: {totalCount}
            </div>
            <div>
              Attendes: {
                weeklyData.find(w => w.week === week)?.attended ?? 0
              }
            </div>
              <div>
              Absentes: {(totalCount ?? 0) - (weeklyData.find(w => w.week === week)?.attended ?? 0)}
            </div>
          </div>
          <div className='flex gap-2'>
            <button onClick={handleEdit} disabled={isEditing}
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50">
              Edit
            </button>
            <button onClick={handleSave} disabled={!isEditing}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50">
              Save
            </button>
            </div>
        </div>

        <div className="shadow-lg rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {/* Name column remains sortable by header click */}
                  <th scope="col" rowSpan={2} className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider align-middle cursor-pointer hover:bg-gray-200" onClick={() => requestSort('name')}>
                    Name{getSortIndicator('name')}
                  </th>
                 
                  <th scope="col" rowSpan={2} className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider align-middle">Github</th>
                
                  {/* Group column is now filtered by dropdown, not sorted by header click */}
                   {week > 0 ? 
                  <th scope="col" rowSpan={2} className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell align-middle">
                    Group
                  </th>
                    : null}
                  {/* TA column is now filtered by dropdown, not sorted by header click */}
                  <th scope="col" rowSpan={2} className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell align-middle">
                    TA
                  </th>
                  <th scope="col" rowSpan={2} className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell align-middle">Attendance</th>
                  <th scope="col" colSpan={4} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">GD SCORE</th>
                  <th scope="col" colSpan={3} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">BONUS SCORE</th>
                  <th scope="col" colSpan={4} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">EXERCISE SCORES</th>
                  <th scope="col" rowSpan={2} className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider align-middle">Total</th>
                </tr>
                {/* Sub-headers row (unchanged) */}
                <tr className="bg-gray-100">
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Communication</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Depth Of Answer</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Technical Bitcoin Fluency</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Engagement</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Attempt</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Good</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Follow Up</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Submitted</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Github Test</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Good Structure</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Good doc</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedData.map((person) => (
                  <tr key={person.id} className="hover:bg-gray-50 transition-colors duration-150">
                    {/* Data cells (unchanged structure, but content reflects filtering/sorting) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-medium">
                            {person.name.charAt(0)}{person.name.split(' ')[1]?.charAt(0) || ''}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{person.name}</div>
                        </div>
                      </div>
                    </td>
                   
                    <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-gray-900">{person.email}</div>
                    </td>
                   
                     {week > 0 ?
                    <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-gray-900">{person.group}</div>
                    </td>
                     : null}
                    <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-500">{person.ta}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                      <input type="checkbox" checked={person.attendance} disabled={!isEditing}
                        onChange={() => setData(prev => prev.map(p => p.id === person.id ? { ...p, attendance: !p.attendance } : p))}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"/>
                    </td>
                    {(['fa', 'fb', 'fc', 'fd'] as const).map(key => (
                      <td key={key} className="px-3 py-4 whitespace-nowrap text-center text-sm">
                        <select value={person.gdScore[key]} disabled={!canEditFields}
                          onChange={e => handleGdScoreChange(person.id, key, e.target.value)}
                          className="border border-gray-300 rounded-md shadow-sm p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed">
                          {[0, 1, 2, 3, 4, 5].map(val => (<option key={val} value={val}>{val === 0 ? '-' : val}</option>))}
                        </select>
                      </td>
                    ))}

                    {(['attempt', 'good', 'followUp'] as const).map(key => (
                      <td key={key} className="px-3 py-4 whitespace-nowrap text-center text-sm">
                      <select value={person.bonusScore[key]} disabled={!canEditFields}
                          onChange={e => handleBonusScoreChange(person.id, key, e.target.value)}
                          className="border border-gray-300 rounded-md shadow-sm p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed">
                          {[0, 1, 2, 3, 4, 5].map(val => (<option key={val} value={val}>{val === 0 ? '-' : val}</option>))}
                        </select>
                      </td>
                    ))}
                    {(['Submitted', 'privateTest', 'goodStructure', 'goodDoc'] as const).map(key => (
                      <td key={key} className="px-3 py-4 whitespace-nowrap text-center text-sm">
                      <input
                        type="checkbox"
                        checked={person.exerciseScore[key]}
                        disabled={
                        !canEditFields ||
                        key === 'Submitted' ||
                        key === 'privateTest'
                        }
                        onChange={() => handleExerciseScoreChange(person.id, key)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
                      />
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-700">
                      {isEditing ? computeTotal(person) : person.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {processedData.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No data available {searchTerm || selectedGroup !== 'All Groups' || selectedTA !== 'All TAs' ? 'for your current filters' : ''}.
            </div>
          )}
          {processedData.length > 0 && (
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              {/* Pagination (remains placeholder, text uses processedData.length) */}
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">1</span> to <span className="font-medium">{Math.min(10, processedData.length)}</span> of{' '}
                    <span className="font-medium">{processedData.length}</span> results
                  </p>
                </div>
                {/* Pagination buttons (placeholder) */}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableView;