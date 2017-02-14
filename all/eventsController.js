(() => {
  'use strict';
  const baseUrl = baseUrlRepository['oms-events'];
  const apiUrl = `${baseUrl}api/`;

  const showError = (err) => {
    console.log(err);
    let message = 'Unknown cause';

    if (err && err.message) {
      message = err.message;
    } else if (err && err.data && err.data.message) {
      message = err.data.message;
    }

    $.gritter.add({
      title: 'Error',
      text: `Could not process action: ${message}`,
      sticky: false,
      time: 8000,
      class_name: 'my-sticky-class',
    });
  };

  /** @ngInject */
  function config($stateProvider) {
    // State
    $stateProvider
      .state('app.events', {
        url: '/events',
        data: { pageTitle: 'All Events' },
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/all/listing.html`,
            controller: 'ListingController as vm',
          },
        },
      })
      .state('app.events.mine', {
        url: '/mine',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/all/listing.html`,
            controller: 'MineController as vm',
          },
        },

      })
      .state('app.events.single', {
        url: '/view/:id',
        data: { pageTitle: 'Single Event' },
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/all/single.html`,
            controller: 'SingleController as vm',
          },
        },
      })
      .state('app.events.organizers', {
        url: '/organizers/:id',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/all/userListing.html`,
            controller: 'OrganizersController as vm',
          },
        },
      })
      .state('app.events.participants', {
        url: '/participants/:id',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/all/userListing.html`,
            controller: 'ParticipantsController as vm',
          },
        },
      })
      .state('app.events.apply', {
        url: '/apply/:id',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/all/apply.html`,
            controller: 'ApplyController as vm',
          },
        },
      });
  }

  const initTimeline = ($scope) => {
    $scope.typequery = {};
    $scope.currentTime = Date.now(); // get the current time for the timeline

    // Search callback to enable searching in name and description only
    $scope.search = (row) => {
      const statusTypes = Object
        .keys($scope.typequery)
        .filter(type => $scope.typequery[type]);

      const query = angular.lowercase($scope.query);

      return statusTypes.find(item => item === row.type) &&
          (angular.lowercase(row.name).indexOf(query || '') !== -1 ||
          angular.lowercase(row.description).indexOf(query || '') !== -1);
    };
  };

  function ListingController($scope, $http) {
    initTimeline($scope);

    $http.get(`${apiUrl}lifecycle/names`).success((response) => {
      $scope.eventTypeNames = response.data;
      $scope.eventTypeNames.forEach((name) => { $scope.typequery[name] = true; });
    }).catch(showError);

    // Fetch events from backend
    // $('#loadingOverlay').show();
    $http.get(apiUrl).success((response) => {
      $scope.events = response;
      // $('#loadingOverlay').hide();
    }).catch(showError);
  }

  function MineController($scope, $http) {
    initTimeline($scope);

    $scope.mine = true;
    $scope.events = [];

    // Fetch events where user is organizer on
    $http.get(`${apiUrl}mine/byOrganizer`).success((response) => {
      $scope.events.push.apply($scope.events, response);
    }).catch(showError);

    // And also get all those the user has applied to
    $http.get(`${apiUrl}mine/byApplication`).success((response) => {
      $scope.events.push.apply($scope.events, response);
    }).catch(showError);
  }

  function SingleController($scope, $http, $stateParams) {
    $scope.baseUrl = baseUrl;

    // Fetch event from backend
    $http.get(`${apiUrl}single/${$stateParams.id}`).success((res) => {
      $scope.event = res;
      console.log(res);
    }).catch(showError);

    // TODO integrate this into the /single requers
    $http.get(`${apiUrl}single/${$stateParams.id}/rights`).success((res) => {
      $scope.permissions = res.can;
    }).catch(showError);
  }

  function ApplyController($scope, $http, $stateParams) {
    $scope.newapplication = true;
    $scope.saved = false;
    // Fetch event again to get form fields
    // Also fetch if the user already has put an applicaiton
    const reqPromise = $http.get(`${apiUrl}single/${$stateParams.id}/participants/mine`);
    $http.get(`${apiUrl}single/${$stateParams.id}`).success((event) => {
      // Save fetched event to scope
      $scope.event = event;

      // Poll for existing application
      reqPromise.success((res) => {
        $scope.newapplication = false;
        $scope.saved = true;
        // Loop through application fields and assign them to our model
        res.application.forEach((field) => {
          // Find the matching application_field to our users application field
          $scope.event.application_fields.some((item, index) => {
            if (field.field_id === item._id) {
              $scope.event.application_fields[index].answer = field.value;
              return true;
            }
            return false;
          });
        });

        $scope.application_status = res.application_status;
      }).catch(() => {
        // User doesn't have submitted an application yet or something went wrong
      });
    }).catch(showError);

    // Sumbit form callback
    $scope.submitForm = () => {
      // Copy data from the form into an object to submit it in the format the backend needs it
      const toServer = { application: [] };
      $scope.event.application_fields.forEach((field) => {
        if (field.answer) {
          toServer.application.push({
            field_id: field._id,
            value: field.answer,
          });
        }
      });

      $http.put(`${apiUrl}single/${$stateParams.id}/participants/mine`, toServer).success(() => {
        $.gritter.add({
          title: 'Application saved',
          text: 'Your application was saved, you can still edit it until the application period ends',
          sticky: false,
          time: 8000,
          class_name: 'my-sticky-class',
        });
        $scope.saved = true;
        $scope.newapplication = false;
        $scope.application_status = 'requesting';
      }).catch(showError);
    };
  }


  function OrganizersController($scope, $http, $stateParams) {
    $scope.organizer_view = true;
    $scope.order = 'user.main_organizer';
    $scope.setSearch = (local) => {
      if (local) {
        $scope.query_antenna = local.foreign_id;
      } else {
        $scope.query_antenna = '';
      }
    };

    $scope.search = (row) => {
      const query = angular.lowercase($scope.query_name);
      const name = angular.lowercase(`${row.first_name} ' + ${row.last_name}`);
      return (!$scope.query_antenna || row.antenna_id === $scope.query_antenna)
        && (!$scope.query_name || name.indexOf(query) !== -1);
    };

    $http.get(`${apiUrl}single/${$stateParams.id}`).success((res) => {
      $scope.users = res.organizers;
      $scope.locals = [];
      res.organizers.forEach((user) => {
        if (!$scope.locals.some(local => local.foreign_id === user.antenna_id)) {
          $scope.locals.push({
            foreign_id: user.antenna_id,
            name: user.antenna_name,
          });
        }
      });
    }).catch(showError);
  }

  function ParticipantsController($scope, $http, $stateParams) {
    $scope.organizer_view = false;
    // Sort by random
    $scope.order = () => 0.5 - Math.random();

    $scope.setSearch = (local) => {
      if (local) {
        $scope.search = { antenna_id: local.foreign_id };
      } else {
        $scope.search = {};
      }
    };

    $http.get(`${apiUrl}single/${$stateParams.id}/participants?status=accepted`).success((res) => {
      $scope.users = res;
      $scope.locals = [];
      res.forEach((user) => {
        if (!$scope.locals.some(local => local.foreign_id === user.antenna_id)) {
          $scope.locals.push({
            foreign_id: user.antenna_id,
            name: user.antenna,
          });
        }
      });
    }).catch(showError);
  }

  angular
    .module('app.events', [])
    .config(config)
    .controller('ListingController', ListingController)
    .controller('MineController', MineController)
    .controller('SingleController', SingleController)
    .controller('ApplyController', ApplyController)
    .controller('OrganizersController', OrganizersController)
    .controller('ParticipantsController', ParticipantsController);
})();

