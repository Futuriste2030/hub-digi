from rest_framework.routers import DefaultRouter

from .views import CampaignViewSet, CommuniqueViewSet, MediaViewSet, PublicationViewSet

router = DefaultRouter()
router.register("com/campaigns", CampaignViewSet, basename="campaign")
router.register("com/calendar", PublicationViewSet, basename="publication")
router.register("com/medias", MediaViewSet, basename="media")
router.register("com/communiques", CommuniqueViewSet, basename="communique")

urlpatterns = router.urls
