import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  CheckSquare,
  Clock,
  AlertCircle,
  Flag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types
interface TaskBoard {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

interface TaskList {
  id: string;
  boardId: string;
  name: string;
  position: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface Task {
  id: string;
  boardId: string;
  listId: string;
  title: string;
  description?: string;
  position: string;
  status: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  createdBy: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Priority colors
const priorityColors = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const priorityIcons = {
  low: <Flag className="w-3 h-3" />,
  medium: <Flag className="w-3 h-3" />,
  high: <Flag className="w-3 h-3" />,
  urgent: <AlertCircle className="w-3 h-3" />,
};

export default function Tache() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedListForTask, setSelectedListForTask] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");
  const [newListName, setNewListName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Task["priority"]>("medium");

  // Fetch boards
  const { data: boards, isLoading: boardsLoading } = useQuery<TaskBoard[]>({
    queryKey: ["/api/tasks/boards"],
  });

  // Fetch lists for selected board
  const { data: lists, isLoading: listsLoading } = useQuery<TaskList[]>({
    queryKey: [`/api/tasks/lists/${selectedBoard}`],
    enabled: !!selectedBoard,
  });

  // Fetch tasks for selected board
  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: [`/api/tasks/${selectedBoard}`],
    enabled: !!selectedBoard,
  });

  // Auto-select first board
  useEffect(() => {
    if (boards && boards.length > 0 && !selectedBoard) {
      setSelectedBoard(boards[0].id);
    }
  }, [boards, selectedBoard]);

  // Create board mutation
  const createBoardMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch("/api/tasks/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create board");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/boards"] });
      toast({ title: "Tableau créé", description: "Le tableau a été créé avec succès" });
      setIsCreateBoardOpen(false);
      setNewBoardName("");
      setNewBoardDescription("");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le tableau", variant: "destructive" });
    },
  });

  // Create list mutation
  const createListMutation = useMutation({
    mutationFn: async (data: { boardId: string; name: string }) => {
      const res = await fetch("/api/tasks/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create list");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/lists/${selectedBoard}`] });
      toast({ title: "Liste créée", description: "La liste a été créée avec succès" });
      setIsCreateListOpen(false);
      setNewListName("");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer la liste", variant: "destructive" });
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: {
      boardId: string;
      listId: string;
      title: string;
      description?: string;
      priority?: Task["priority"];
    }) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${selectedBoard}`] });
      toast({ title: "Tâche créée", description: "La tâche a été créée avec succès" });
      setIsCreateTaskOpen(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setSelectedListForTask(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer la tâche", variant: "destructive" });
    },
  });

  // Update task mutation (for drag and drop)
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${selectedBoard}`] });
    },
  });

  // Handle drag end
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !tasks) return;

    const { source, destination, draggableId } = result;

    // Same position, no change
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const task = tasks.find((t) => t.id === draggableId);
    if (!task) return;

    // Calculate new position using fractional positioning
    const destinationListTasks = tasks
      .filter((t) => t.listId === destination.droppableId && t.id !== draggableId)
      .sort((a, b) => parseFloat(a.position) - parseFloat(b.position));

    let newPosition: string;
    if (destinationListTasks.length === 0) {
      newPosition = "1.0";
    } else if (destination.index === 0) {
      // Insert at beginning
      const firstPos = parseFloat(destinationListTasks[0].position);
      newPosition = (firstPos / 2).toString();
    } else if (destination.index >= destinationListTasks.length) {
      // Insert at end
      const lastPos = parseFloat(destinationListTasks[destinationListTasks.length - 1].position);
      newPosition = (lastPos + 1).toString();
    } else {
      // Insert between two tasks
      const prevPos = parseFloat(destinationListTasks[destination.index - 1].position);
      const nextPos = parseFloat(destinationListTasks[destination.index].position);
      newPosition = ((prevPos + nextPos) / 2).toString();
    }

    // Update task
    updateTaskMutation.mutate({
      id: draggableId,
      data: {
        listId: destination.droppableId,
        position: newPosition,
      },
    });
  };

  const handleCreateBoard = () => {
    if (!newBoardName.trim()) return;
    createBoardMutation.mutate({
      name: newBoardName,
      description: newBoardDescription || undefined,
    });
  };

  const handleCreateList = () => {
    if (!newListName.trim() || !selectedBoard) return;
    createListMutation.mutate({
      boardId: selectedBoard,
      name: newListName,
    });
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim() || !selectedListForTask || !selectedBoard) return;
    createTaskMutation.mutate({
      boardId: selectedBoard,
      listId: selectedListForTask,
      title: newTaskTitle,
      description: newTaskDescription || undefined,
      priority: newTaskPriority,
    });
  };

  if (boardsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des tableaux...</p>
        </div>
      </div>
    );
  }

  if (!boards || boards.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tâches</h1>
              <p className="text-muted-foreground">Gestion de tâches avec tableaux Kanban</p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-center">Aucun tableau</CardTitle>
              <CardDescription className="text-center">
                Créez votre premier tableau pour commencer à gérer vos tâches
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Dialog open={isCreateBoardOpen} onOpenChange={setIsCreateBoardOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Créer un tableau
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouveau tableau</DialogTitle>
                    <DialogDescription>
                      Créez un tableau pour organiser vos tâches par projet ou équipe
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="board-name">Nom du tableau</Label>
                      <Input
                        id="board-name"
                        placeholder="ex: Projet RAMQ"
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateBoard()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="board-description">Description (optionnel)</Label>
                      <Textarea
                        id="board-description"
                        placeholder="Description du tableau"
                        value={newBoardDescription}
                        onChange={(e) => setNewBoardDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateBoardOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleCreateBoard} disabled={!newBoardName.trim()}>
                      Créer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentBoard = boards.find((b) => b.id === selectedBoard);
  const sortedLists = lists?.sort((a, b) => parseFloat(a.position) - parseFloat(b.position)) || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{currentBoard?.name || "Tâches"}</h1>
              <p className="text-muted-foreground">{currentBoard?.description || "Gestion de tâches Kanban"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Board selector */}
            <Select value={selectedBoard || undefined} onValueChange={setSelectedBoard}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sélectionner un tableau" />
              </SelectTrigger>
              <SelectContent>
                {boards.map((board) => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={isCreateBoardOpen} onOpenChange={setIsCreateBoardOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau tableau
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouveau tableau</DialogTitle>
                  <DialogDescription>
                    Créez un tableau pour organiser vos tâches par projet ou équipe
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-board-name">Nom du tableau</Label>
                    <Input
                      id="new-board-name"
                      placeholder="ex: Projet RAMQ"
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateBoard()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-board-description">Description (optionnel)</Label>
                    <Textarea
                      id="new-board-description"
                      placeholder="Description du tableau"
                      value={newBoardDescription}
                      onChange={(e) => setNewBoardDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateBoardOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreateBoard} disabled={!newBoardName.trim()}>
                    Créer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="flex-1 p-6 overflow-x-auto">
        {listsLoading || tasksLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement du tableau...</p>
            </div>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 h-full">
              {/* Lists */}
              {sortedLists.map((list) => {
                const listTasks = tasks
                  ?.filter((t) => t.listId === list.id && !t.deletedAt)
                  .sort((a, b) => parseFloat(a.position) - parseFloat(b.position)) || [];

                return (
                  <div key={list.id} className="flex-shrink-0 w-80">
                    <Card className="h-full flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{list.name}</CardTitle>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedListForTask(list.id);
                                  setIsCreateTaskOpen(true);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Ajouter une tâche
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{listTasks.length} tâche{listTasks.length !== 1 ? 's' : ''}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedListForTask(list.id);
                              setIsCreateTaskOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="flex-1 overflow-y-auto pt-0">
                        <Droppable droppableId={list.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`space-y-2 min-h-[100px] rounded-md transition-colors ${
                                snapshot.isDraggingOver ? "bg-accent/50" : ""
                              }`}
                            >
                              {listTasks.map((task, index) => (
                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                  {(provided, snapshot) => (
                                    <Card
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`cursor-move transition-shadow ${
                                        snapshot.isDragging ? "shadow-lg" : ""
                                      }`}
                                    >
                                      <CardContent className="p-3">
                                        <div className="space-y-2">
                                          <div className="flex items-start justify-between gap-2">
                                            <h4 className="font-medium text-sm leading-tight flex-1">
                                              {task.title}
                                            </h4>
                                            {task.priority && (
                                              <Badge
                                                variant="outline"
                                                className={`${priorityColors[task.priority]} text-xs px-1.5 py-0.5 flex items-center gap-1`}
                                              >
                                                {priorityIcons[task.priority]}
                                                {task.priority}
                                              </Badge>
                                            )}
                                          </div>

                                          {task.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                              {task.description}
                                            </p>
                                          )}

                                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            {task.dueDate && (
                                              <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(task.dueDate).toLocaleDateString("fr-CA")}
                                              </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                              <CheckSquare className="w-3 h-3" />
                                              {task.status}
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}

              {/* Add List Button */}
              <div className="flex-shrink-0 w-80">
                <Dialog open={isCreateListOpen} onOpenChange={setIsCreateListOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-full min-h-[200px] border-dashed">
                      <Plus className="w-5 h-5 mr-2" />
                      Ajouter une liste
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nouvelle liste</DialogTitle>
                      <DialogDescription>
                        Créez une liste pour organiser vos tâches (ex: À faire, En cours, Terminé)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="list-name">Nom de la liste</Label>
                        <Input
                          id="list-name"
                          placeholder="ex: À faire"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateListOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleCreateList} disabled={!newListName.trim()}>
                        Créer
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle tâche</DialogTitle>
            <DialogDescription>
              Créez une tâche dans la liste sélectionnée
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Titre de la tâche</Label>
              <Input
                id="task-title"
                placeholder="ex: Valider les codes RAMQ"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description (optionnel)</Label>
              <Textarea
                id="task-description"
                placeholder="Description de la tâche"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-priority">Priorité</Label>
              <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as Task["priority"])}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
