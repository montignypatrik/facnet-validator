import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, Video, FileText, Award, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";

interface Course {
  id: string;
  title: string;
  description: string;
  duration: string;
  level: string;
  status: string;
}

interface Resource {
  id: string;
  title: string;
  type: string;
  category: string;
  url: string;
}

interface UserProgress {
  userId: string;
  coursesCompleted: number;
  coursesInProgress: number;
  totalCourses: number;
  completionRate: number;
  courses: Array<{
    courseId: string;
    title: string;
    progress: number;
    completedAt?: string;
    startedAt?: string;
  }>;
}

export default function Formation() {
  const { data: courses } = useQuery<{ data: Course[] }>({
    queryKey: ["/api/formation/courses"],
  });

  const { data: resources } = useQuery<{ data: Resource[] }>({
    queryKey: ["/api/formation/resources"],
  });

  const { data: progress } = useQuery<UserProgress>({
    queryKey: ["/api/formation/progress"],
  });

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Formation & Ressourcement</h1>
        <p className="text-muted-foreground">
          Accédez à des formations spécialisées et des ressources pour maîtriser la facturation RAMQ
        </p>
      </div>

      {/* Progress Overview */}
      {progress && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Formations Complétées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{progress.coursesCompleted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">En Cours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{progress.coursesInProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{progress.totalCourses}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Taux de Complétion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{progress.completionRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Available Courses */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center">
          <GraduationCap className="w-6 h-6 mr-2" />
          Formations Disponibles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses?.data?.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  <Badge variant="secondary">{course.level}</Badge>
                </div>
                <CardDescription className="text-sm">{course.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-1" />
                    {course.duration}
                  </div>
                  <Button size="sm">
                    Commencer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Resources Library */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center">
          <BookOpen className="w-6 h-6 mr-2" />
          Bibliothèque de Ressources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resources?.data?.map((resource) => (
            <Card key={resource.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    {resource.type === "PDF" ? (
                      <FileText className="w-6 h-6 text-primary" />
                    ) : (
                      <Video className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground mb-1">{resource.title}</h3>
                    <Badge variant="outline" className="text-xs mb-2">{resource.category}</Badge>
                    <Button size="sm" variant="link" className="p-0 h-auto">
                      Télécharger
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* My Progress */}
      {progress && progress.courses.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center">
            <Award className="w-6 h-6 mr-2" />
            Mon Parcours
          </h2>
          <div className="space-y-4">
            {progress.courses.map((course) => (
              <Card key={course.courseId}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-foreground">{course.title}</h3>
                    <span className="text-sm font-medium text-primary">{course.progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                  {course.completedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Complété le {new Date(course.completedAt).toLocaleDateString('fr-CA')}
                    </p>
                  )}
                  {course.startedAt && !course.completedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Commencé le {new Date(course.startedAt).toLocaleDateString('fr-CA')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
