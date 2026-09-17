import { EntityGrid } from '@/components/common/entity-grid';

export default function GroupsFromForestPage() {
  return (
    <EntityGrid
      apiRoute="GroupsFromForest"
      keyField="id"
      columns={[
        { dataField: 'id', caption: 'ID', dataType: 'number', allowEditing: false },
        { dataField: 'domainname', caption: 'Domain', dataType: 'string' },
        {
          dataField: 'unitid',
          caption: 'Μονάδα',
          dataType: 'number',
          lookup: { apiRoute: 'Organizations', valueExpr: 'placementId', displayExpr: 'title' },
        },
        { dataField: 'description', caption: 'Περιγραφή', dataType: 'string' },
      ]}
    />
  );
}
