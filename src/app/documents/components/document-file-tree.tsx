'use client';

import {
  FileText,
  Search,
  Eye,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { type DocumentFromDrive } from '@/features/document/schemas';

interface DocumentFileTreeProps {
  documentsFromDrive: DocumentFromDrive[];
}

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  caseId?: string;
  document?: Document;
  documentFromDrive?: DocumentFromDrive;
  path?: string[];
  children: TreeNode[];
}

const formatFileSize = (sizeStr: string): string => {
  const size = parseInt(sizeStr);
  if (isNaN(size)) return sizeStr;

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let fileSize = size;

  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }

  return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
};

export function DocumentFileTree({
  documentsFromDrive,
}: Readonly<DocumentFileTreeProps>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [previewDoc, setPreviewDoc] = useState<{
    name: string;
    driveId: string;
    mimeType?: string;
  } | null>(null);

  const isPreviewable = (mimeType?: string, fileName?: string): boolean => {
    if (mimeType?.startsWith('application/pdf')) return true;
    if (mimeType?.startsWith('image/')) return true;
    if (fileName) {
      const ext = fileName.split('.').pop()?.toLowerCase();
      return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext ?? '');
    }
    return false;
  };

  const buildTree = (documentsFromDrive: DocumentFromDrive[]): TreeNode[] => {
    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // First pass: create a stable mapping for node IDs
    const getUniqueNodeId = (
      item: DocumentFromDrive,
      index: number,
    ): string => {
      if (item.googleDriveId && item.googleDriveId.trim()) {
        return item.googleDriveId;
      }
      // Create a stable unique ID based on item properties and index
      return `generated-${item.fileName}-${item.isFolder ? 'folder' : 'file'}-${index}`;
    };

    // Create all nodes first
    documentsFromDrive.forEach((item, index) => {
      const nodeId = getUniqueNodeId(item, index);

      const node: TreeNode = {
        id: nodeId,
        name: item.fileName,
        type: item.isFolder ? 'folder' : 'file',
        path: item.folderPath,
        children: [],
        documentFromDrive: item,
      };
      nodeMap.set(nodeId, node);
    });

    // Second pass: build the tree structure
    documentsFromDrive.forEach((item, index) => {
      const nodeId = getUniqueNodeId(item, index);
      const node = nodeMap.get(nodeId)!;

      if (item.parentFolderId && item.parentFolderId.trim()) {
        // Find parent by googleDriveId
        const parentItem = documentsFromDrive.find(
          (parent) => parent.googleDriveId === item.parentFolderId,
        );

        if (parentItem) {
          const parentIndex = documentsFromDrive.indexOf(parentItem);
          const parentNodeId = getUniqueNodeId(parentItem, parentIndex);
          const parentNode = nodeMap.get(parentNodeId);

          if (parentNode) {
            parentNode.children.push(node);
          } else {
            rootNodes.push(node);
          }
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    const sortChildren = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          node.children.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
          });
          sortChildren(node.children);
        }
      });
    };

    rootNodes.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    sortChildren(rootNodes);
    return rootNodes;
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const renderTreeNode = (
    node: TreeNode,
    depth: number = 0,
  ): React.ReactNode => {
    const indentStyle = {
      paddingLeft: `${depth * 24}px`,
    };

    if (node.type === 'folder') {
      // Always use node.id as the folderKey since it's guaranteed to be unique and non-empty
      const folderKey = node.id;
      const isExpanded = expandedFolders.has(folderKey);

      return (
        <Collapsible
          key={node.id}
          open={isExpanded}
          onOpenChange={() => toggleFolder(folderKey)}
        >
          <CollapsibleTrigger
            className="hover:bg-muted flex w-full items-center rounded-md px-3 py-2 text-left"
            style={indentStyle}
          >
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground mr-2 h-4 w-4" />
            ) : (
              <ChevronRight className="text-muted-foreground mr-2 h-4 w-4" />
            )}
            {isExpanded ? (
              <FolderOpen className="text-primary mr-2 h-5 w-5" />
            ) : (
              <Folder className="text-primary mr-2 h-5 w-5" />
            )}
            <span className="text-foreground font-medium">{node.name}</span>
            <span className="text-muted-foreground ml-auto text-xs">
              {node.children.length} documentos
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1">
            {node.children.map((child) => (
              <div key={child.id}>{renderTreeNode(child, depth + 1)}</div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    if (node.documentFromDrive && !node.documentFromDrive.isFolder) {
      const doc = node.documentFromDrive;
      return (
        <div
          key={node.id}
          className={`hover:bg-muted flex items-center justify-between rounded-md px-3 py-2 ${depth > 0 ? 'bg-muted/50' : ''}`}
          style={indentStyle}
        >
          <div className="flex flex-1 items-center">
            <FileText className="text-muted-foreground mr-2 h-4 w-4" />
            <span className="text-foreground truncate">{node.name}</span>
            {doc.size && (
              <span className="text-muted-foreground ml-2 text-xs">
                {formatFileSize(doc.size)}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {isPreviewable(doc.mimeType, doc.fileName) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPreviewDoc({
                    name: doc.fileName,
                    driveId: doc.googleDriveId ?? '',
                    mimeType: doc.mimeType,
                  })
                }
                className="h-8 w-8 p-0"
                title="Vista previa"
              >
                <FileText className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(
                  `https://drive.google.com/file/d/${doc.googleDriveId}/view`,
                  '_blank',
                )
              }
              className="h-8 w-8 p-0"
              title="Ver en Google Drive"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  const treeNodes = buildTree(documentsFromDrive);

  const filteredTreeNodes = treeNodes.filter((node) => {
    if (searchTerm === '') return true;

    const searchLower = searchTerm.toLowerCase();
    const nodeMatches = node.name.toLowerCase().includes(searchLower);
    const childrenMatch = node.children.some((child) =>
      child.name.toLowerCase().includes(searchLower),
    );

    return nodeMatches || childrenMatch;
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documentos Generados</CardTitle>
              <CardDescription>Documentos organizados por caso</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-80 pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {filteredTreeNodes.length > 0 ? (
              filteredTreeNodes.map((node) => (
                <div key={node.id}>{renderTreeNode(node)}</div>
              ))
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p>No se encontraron documentos</p>
                <p className="text-sm">
                  Genera documentos para un caso para verlos aquí
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={previewDoc !== null}
        onOpenChange={() => setPreviewDoc(null)}
      >
        <DialogContent className="max-h-[90vh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{previewDoc?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewDoc(null)}
                className="h-8 w-8 shrink-0 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div
              className="flex items-center justify-center overflow-auto"
              style={{ height: '70vh' }}
            >
              <iframe
                src={`https://drive.google.com/file/d/${previewDoc.driveId}/preview`}
                className="h-full w-full rounded border-0"
                title={previewDoc.name}
                allow="autoplay"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
