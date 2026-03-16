'use client';

import {
  FileText,
  Search,
  Eye,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';

import type { DocumentTemplate } from '@/features/document/schemas';

interface DocumentTemplateLibraryProps {
  templates: DocumentTemplate[];
}

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string[];
  template?: DocumentTemplate;
  children: TreeNode[];
  isExpanded?: boolean;
}

export function DocumentTemplateLibrary({
  templates,
}: Readonly<DocumentTemplateLibraryProps>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  const buildTree = (templates: DocumentTemplate[]): TreeNode[] => {
    const folders = templates.filter((t) => t.isFolder);
    const files = templates.filter((t) => !t.isFolder);

    const rootFiles = files.filter((file) => file.folderPath.length === 0);
    const folderFiles = files.filter((file) => file.folderPath.length > 0);

    const folderNodes: TreeNode[] = folders.map((folder) => {
      const folderPath = folder.folderPath.join('/');
      return {
        id: `folder-${folder.id}`,
        name: folder.fileName,
        type: 'folder' as const,
        path: folder.folderPath,
        children: [],
        isExpanded: expandedFolders.has(folderPath),
      };
    });

    folderFiles.forEach((file) => {
      const fileNode: TreeNode = {
        id: `file-${file.id}`,
        name: file.fileName,
        type: 'file' as const,
        path: file.folderPath,
        template: file,
        children: [],
      };

      const parentFolder = folderNodes.find((folder) => {
        return (
          folder.path.length === file.folderPath.length &&
          folder.path.every(
            (segment, index) => segment === file.folderPath[index],
          )
        );
      });

      if (parentFolder) {
        parentFolder.children.push(fileNode);
      }
    });

    const rootNodes: TreeNode[] = [];
    const processedFolders = new Set<string>();

    rootFiles.forEach((file) => {
      const fileNode: TreeNode = {
        id: `file-${file.id}`,
        name: file.fileName,
        type: 'file' as const,
        path: file.folderPath,
        template: file,
        children: [],
      };
      rootNodes.push(fileNode);
    });

    folderNodes.forEach((folder) => {
      if (folder.type === 'file') {
        return;
      }

      if (processedFolders.has(folder.id)) return;

      if (folder.path.length === 1) {
        rootNodes.push(folder);
        processedFolders.add(folder.id);
      } else {
        const parentPath = folder.path.slice(0, -1);
        const parentFolder = folderNodes.find(
          (f) =>
            f.type === 'folder' &&
            f.path.length === parentPath.length &&
            f.path.every((segment, index) => segment === parentPath[index]),
        );

        if (parentFolder) {
          parentFolder.children.push(folder);
          processedFolders.add(folder.id);
        } else {
          rootNodes.push(folder);
          processedFolders.add(folder.id);
        }
      }
    });

    const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
      const sorted = nodes.toSorted((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });

      return sorted.map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }));
    };

    const finalTree = sortNodes(rootNodes);
    return finalTree;
  };

  const filteredTemplates = templates.filter((template) =>
    template.fileName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const treeNodes = buildTree(filteredTemplates);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(folderPath)) {
        newExpanded.delete(folderPath);
      } else {
        newExpanded.add(folderPath);
      }
      return newExpanded;
    });
  };

  const renderTreeNode = (
    node: TreeNode,
    depth: number = 0,
  ): React.ReactNode => {
    const folderPath = node.path.join('/');
    const isExpanded = expandedFolders.has(folderPath);
    const indentStyle = { paddingLeft: `${depth * 24}px` };

    if (node.type === 'folder') {
      return (
        <Collapsible
          key={node.id}
          open={isExpanded}
          onOpenChange={() => toggleFolder(folderPath)}
        >
          <CollapsibleTrigger
            className="hover:bg-muted flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left"
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
              {node.children.length} elementos
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

    if (node.template) {
      return (
        <div
          key={node.id}
          className={`hover:bg-muted flex items-center justify-between rounded-md px-3 py-2 ${depth > 0 ? 'bg-muted/50' : ''}`}
          style={indentStyle}
        >
          <div className="flex flex-1 items-center">
            <FileText className="text-muted-foreground mr-2 h-4 w-4" />
            <span className="text-foreground truncate">{node.name}</span>
            <Badge variant="outline" className="ml-2 text-xs">
              {node.template.mimeType.includes('word') ? 'Word' : 'Doc'}
            </Badge>
            <Badge variant="outline" className="ml-2 text-xs">
              {node.template.placeholders.length} campos
            </Badge>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(
                  `https://drive.google.com/file/d/${node.template!.googleDriveId}/view`,
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

  const filteredTreeNodes = treeNodes.filter((node) =>
    node.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Biblioteca de Plantillas</CardTitle>
              <CardDescription>
                Plantillas de documentos legales disponibles en el sistema
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  placeholder="Buscar plantillas..."
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
                <p>No se encontraron plantillas</p>
                <p className="text-sm">
                  Sincroniza con Google Drive para cargar plantillas
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
