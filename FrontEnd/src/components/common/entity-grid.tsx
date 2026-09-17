import { forwardRef, useMemo } from 'react';
import DataGrid, {
  Column,
  DataGridRef,
  Editing,
  FilterRow,
  Grouping,
  GroupPanel,
  HeaderFilter,
  Lookup,
  Pager,
  Paging,
  RequiredRule,
  Sorting,
  StateStoring,
} from 'devextreme-react/data-grid';
import { createStore } from 'devextreme-aspnet-data-nojquery';
import { getAuth } from '@/auth/lib/helpers';
import { Group } from 'lucide-react';

// Radix Dialog closes on any pointer event outside its content, but DevExtreme
// popup-based editors (TagBox, SelectBox dropdowns, etc.) render their overlay
// in a portal appended to <body> — outside the Dialog's DOM subtree — so a
// selection inside them looks like an "outside click" and closes the dialog.
// Pass this to <DialogContent onInteractOutside={...}> in any dialog that also
// renders a DevExtreme popup-based editor.
export function ignoreDevExtremeOverlayInteraction(event: Event) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('.dx-overlay-wrapper, .dx-overlay-content')) {
    event.preventDefault();
  }
}

const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_LOCAL
  : import.meta.env.VITE_API_URL;

function attachAuthHeader(_method: string, ajaxOptions: any) {
  const auth = getAuth();
  ajaxOptions.headers = {
    ...ajaxOptions.headers,
    Authorization: auth?.token ? `Bearer ${auth.token}` : '',
  };
}

// Shared CustomStore factory for the backend's DataSourceLoader CRUD contract.
// Exported so callers outside the grid (e.g. the app-creation wizard) can reuse
// the exact same wire format instead of hand-rolling HTTP calls.
export function createEntityStore(apiRoute: string, keyField: string) {
  const baseUrl = `${API_BASE_URL}/${apiRoute}`;
  return createStore({
    key: keyField,
    loadUrl: baseUrl,
    insertUrl: baseUrl,
    updateUrl: baseUrl,
    deleteUrl: baseUrl,
    onBeforeSend: attachAuthHeader,
  });
}

// Lookup stores are read-only and shared across every grid that references the
// same entity (e.g. "Applications" is looked up from AppForms, Groups, ManagedUnits...)
// so it isn't re-fetched per column/page.
const lookupStoreCache = new Map<string, ReturnType<typeof createStore>>();
export function getLookupStore(apiRoute: string, keyField: string) {
  const cached = lookupStoreCache.get(apiRoute);
  if (cached) return cached;
  const store = createEntityStore(apiRoute, keyField);
  lookupStoreCache.set(apiRoute, store);
  return store;
}

// Shared filter/sort/paging/state-persistence chrome for every grid — one
// storage key per apiRoute so each grid remembers its own filters, sorting
// and column widths (localStorage) without colliding with the others.
export function GridToolbarDefaults({ apiRoute }: { apiRoute: string }) {
  return (
    <>
      <GroupPanel visible emptyPanelText="Σύρετε εδώ τις στήλες για ομαδοποίηση" />
      <Grouping autoExpandAll />
      <FilterRow visible />
      <HeaderFilter visible />
      <Sorting mode="multiple" />
      <Paging defaultPageSize={20} />
      <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50, 100]} showInfo showNavigationButtons />
      <StateStoring enabled type="localStorage" storageKey={`wam-grid-${apiRoute}`} />
    </>
  );
}

export interface EntityColumn {
  dataField: string;
  caption?: string;
  dataType?: 'string' | 'number' | 'boolean' | 'date';
  allowEditing?: boolean;
  /** Show a related entity's name instead of the raw id (and a picker when editing). */
  lookup?: {
    apiRoute: string;
    valueExpr: string;
    displayExpr: string;
  };
  /** Marks the field required in the add/edit form (red asterisk + inline message on submit). */
  required?: boolean | string;
}

interface EntityGridProps {
  /** Controller route name, e.g. "Applications" — hits {API_BASE_URL}/{apiRoute} */
  apiRoute: string;
  keyField: string;
  columns: EntityColumn[];
  editMode?: 'row' | 'popup';
  /** Fired after a new row is successfully persisted (DevExtreme's onRowInserted). */
  onRowInserted?: (data: any) => void;
  /** Hides the grid's own built-in add-row toolbar button — use when the caller
   * renders its own "+" button (e.g. next to another action button) and
   * triggers add via the forwarded ref's `.instance().addRow()` instead. */
  hideAddButton?: boolean;
}

function onToolbarPreparingHideAdd(e: any) {
  const idx = e.toolbarOptions.items.findIndex((item: any) => item.name === 'addRowButton');
  if (idx !== -1) e.toolbarOptions.items.splice(idx, 1);
}

// Wires a DevExtreme DataGrid to the backend's DataSourceLoader/CustomStore CRUD
// contract (GET with load-options query params, POST/PUT/DELETE with key+values
// form fields) — every /Auth-protected controller in the backend speaks this.
export const EntityGrid = forwardRef<DataGridRef, EntityGridProps>(function EntityGrid(
  { apiRoute, keyField, columns, editMode = 'row', onRowInserted, hideAddButton },
  ref,
) {
  const store = useMemo(() => createEntityStore(apiRoute, keyField), [apiRoute, keyField]);

  return (
    <div className="p-6">
      {/* Own horizontal scroll area — keeps the page (and any header buttons
          above the grid) from being pushed off-screen by a wide grid. */}
      <div className="overflow-x-auto">
        <DataGrid
          ref={ref}
          dataSource={store}
          keyExpr={keyField}
          showBorders
          columnAutoWidth
          repaintChangesOnly
          onRowInserted={onRowInserted ? (e) => onRowInserted(e.data) : undefined}
          onToolbarPreparing={hideAddButton ? onToolbarPreparingHideAdd : undefined}
        >
          <GridToolbarDefaults apiRoute={apiRoute} />
          <Editing mode={editMode} allowAdding allowUpdating allowDeleting useIcons />
          {columns.map((col) => (
            <Column
              key={col.dataField}
              dataField={col.dataField}
              caption={col.caption}
              dataType={col.dataType}
              allowEditing={col.allowEditing}
              formItem={col.allowEditing === false ? { visible: false } : undefined}
              editorOptions={col.lookup ? { searchEnabled: true } : undefined}
            >
              {col.lookup && (
                <Lookup
                  dataSource={getLookupStore(col.lookup.apiRoute, col.lookup.valueExpr)}
                  valueExpr={col.lookup.valueExpr}
                  displayExpr={col.lookup.displayExpr}
                />
              )}
              {col.required && (
                <RequiredRule message={typeof col.required === 'string' ? col.required : `Το πεδίο "${col.caption ?? col.dataField}" είναι υποχρεωτικό.`} />
              )}
            </Column>
          ))}
        </DataGrid>
      </div>
    </div>
  );
});
