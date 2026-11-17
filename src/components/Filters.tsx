'use client';

import { useEffect, useState } from 'react';
import { ClearOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Flex, Input, Segmented, Select } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { isFiltering, type SortDir, type StatusFilter } from '@/lib/query';

const SEARCH_DEBOUNCE_MS = 200;

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'completed', label: 'Completed' },
];

const sortOptions: { value: SortDir; label: string }[] = [
  { value: 'asc', label: 'Due date: soonest first' },
  { value: 'desc', label: 'Due date: latest first' },
  { value: 'manual', label: 'Manual order' },
];

/** Search, status filter and sort. Page size lives in the Pagination size changer. */
export default function Filters() {
  const { query, setQuery } = useTodos();
  // The input updates instantly; the query (and the list) follows after a short pause.
  const [searchText, setSearchText] = useState(query.search);

  useEffect(() => {
    if (searchText === query.search) return;
    const id = setTimeout(() => setQuery({ search: searchText }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchText, query.search, setQuery]);

  const filtering = isFiltering({ search: searchText, status: query.status });

  function clearFilters() {
    setSearchText('');
    setQuery({ search: '', status: 'all' });
  }

  return (
    <Flex gap={8} wrap align="center" role="search" style={{ marginBottom: 8 }}>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search tasks"
        aria-label="Search task descriptions"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ flex: '1 1 220px' }}
      />
      <Segmented<StatusFilter>
        options={statusOptions}
        value={query.status}
        onChange={(status) => setQuery({ status })}
        aria-label="Filter by status"
      />
      <Select<SortDir>
        options={sortOptions}
        value={query.sortDir}
        onChange={(sortDir) => setQuery({ sortDir })}
        style={{ width: 210 }}
        aria-label="Sort order"
      />
      {filtering && (
        <Button icon={<ClearOutlined />} onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </Flex>
  );
}
