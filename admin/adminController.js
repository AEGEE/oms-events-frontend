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
      .state('app.eventadmin', {
        url: '/eventadmin',
        data: { pageTitle: 'Event admin' },
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/admin/dashboard.html`,
            controller: 'DashboardController as vm',
          },
        },
      })
      .state('app.eventadmin.edit', {
        url: '/edit/:id',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/admin/new.html`,
            controller: 'NewController as vm',
          },
        },
      })
      .state('app.eventadmin.new', {
        url: '/new',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/admin/new.html`,
            controller: 'NewController as vm',
          },
        },
      })
      .state('app.eventadmin.approve_participants', {
        url: '/approve_participants/:id',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/admin/approveParticipants.html`,
            controller: 'ApproveParticipantsController as vm',
          },
        },
      })
      .state('app.eventadmin.boardview', {
        url: '/boardview',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/admin/boardview.html`,
            controller: 'BoardviewController as vm',
          },
        },
      })
      .state('app.eventadmin.approve_events', {
        url: '/approve_events',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/admin/approveEvents.html`,
            controller: 'ApproveEventsController as vm',
          },
        },
      })
      .state('app.eventadmin.serviceadmin', {
        url: '/service-admin',
        views: {
          'pageContent@app': {
            templateUrl: `${baseUrl}frontend/admin/serviceadmin.html`,
            controller: 'ServiceAdminController as vm',
          },
        },
      });
  }

  function DashboardController() {

  }

  function NewController($scope, $http, $stateParams, $state, $filter, $parse, FileUploader) {
    $http.get(`${apiUrl}lifecycle/names`).success((response) => {
      $scope.eventTypeNames = response.data;
    }).catch(showError);

    $http.get(`${apiUrl}eventroles`).success((response) => {
      $scope.eventRolesData = response.data;
    }).catch(showError);

    // Per default make event editable
    $scope.permissions = {
      edit_details: true,
      approve: false,
      edit_application_status: false,
      edit: true,
    };
    $scope.event = {};
    $scope.event.application_fields = [];
    $scope.newfield = '';
    $scope.newevent = true;
    $scope.neworganizer = {};

    // Add callbacks to handle application field changes
    $scope.addApplicationField = () => {
      if ($scope.newfield) {
        $scope.event.application_fields.push({ name: $scope.newfield });
      }
      $scope.newfield = '';
    };

    $scope.removeApplicationField = (index) => {
      if ($scope.event.application_fields && $scope.event.application_fields.length > index) {
        $scope.event.application_fields.splice(index, 1);
      }
    };

    $scope.addOrganizer = (organizer) => {
      $scope.event.organizers.push(organizer.originalObject);
      $scope.$broadcast('angucomplete-alt:clearInput', 'addOrganizer');
    };

    $scope.removeOrganizer = (index) => {
      if ($scope.event.organizers && $scope.event.organizers.length > index) {
        $scope.event.organizers.splice(index, 1);
      }
    };

    $scope.addRole = (index, orgid, role) => {
      if(role)
        $scope.event.organizers[index].roles.push(role.originalObject);
      $scope.$broadcast('angucomplete-alt:clearInput', 'role' + index + 'org' + orgid);
    };

    // General callback for calling the API for data
    // Returns a promise for angucomplete-alt that is racing against the timeout, returning the data from the called url
    $scope.fetchUserData = (query, timeout) => {

      // Copied from the angular tutorial on how to add transformations
      function appendTransform(defaults, transform) {
        // We can't guarantee that the default transformation is an array
        defaults = angular.isArray(defaults) ? defaults : [defaults];

        // Append the new transformation to the defaults
        return defaults.concat(transform);
      }

      return $http({
        url: `/api/getUsers?limit=20&name=${query}`,
        method: 'GET',
        transformResponse: appendTransform($http.defaults.transformResponse, function(res) {
          var data = [];
          if(res === null)
            return data;
          res.rows.forEach((item) => {
            data.push({
              foreign_id: item.cell[0],
              name: item.cell[1],
              antenna_name: item.cell[5]
            });
          });
          return data;
        }),
        timeout: timeout
      });
    };

    // If no route params are given, the user wants to create a new event -> Post
    $scope.submitForm = () => {
      $http.post(apiUrl, $scope.event).success((response) => {
        $.gritter.add({
          title: 'Event added',
          text: 'The event was successfully added.',
          sticky: false,
          time: 8000,
          class_name: 'my-sticky-class',
        });
        $state.go('app.events.single', { id: response.event.id });
      }).catch((err) => {
        showError(err);

        for (let attr in err.data.errors) {
          const serverMessage = $parse(`eventForm.${attr}.$error.message`);
          $scope.eventForm.$setValidity(attr, false, $scope.eventForm);
          serverMessage.assign($scope, err.data.errors[attr].message);
        }
      });
    };

    // Load data from server, if eventid specified
    // Also use another submit message
    if ($stateParams.id) {
      $scope.newevent = false;

      // Add callbacks to delete the event
      const resourceURL = `${apiUrl}/single/${$stateParams.id}`;

      // Add callbacks to request approval
      $scope.setApproval = (newStatus) => {
        $http.put(`${resourceURL}/status`, { status: newStatus }).success(() => {
          if (newStatus === 'requesting') {
            $.gritter.add({
              title: 'Approval requested',
              text: 'Your event is now waiting for approval. You can still withdraw your approval request in the edit section',
              sticky: false,
              time: 8000,
              class_name: 'my-sticky-class',
            });
            $state.go('app.events.single', { id: $stateParams.id });
          } else {
            $state.reload();
          }
        }).catch((err) => {
          for (let attr in err.data.errors) {
            const serverMessage = $parse(`eventForm.${attr}.$error.message`);
            $scope.eventForm.$setValidity(attr, false, $scope.eventForm);
            serverMessage.assign($scope, err.data.errors[attr].message);
          }
        });
      };

      // Edit the event with a put
      $scope.submitForm = () => {
        $http.put(resourceURL, $scope.event).success(() => {
          $.gritter.add({
            title: 'Event edited',
            text: 'Your changes were successfully saved.',
            sticky: false,
            time: 8000,
            class_name: 'my-sticky-class',
          });
          $state.reload();
        }).catch((err) => {
          for (let attr in err.data.errors) {
            const serverMessage = $parse(`eventForm.${attr}.$error.message`);
            $scope.eventForm.$setValidity(attr, false, $scope.eventForm);
            serverMessage.assign($scope, err.data.errors[attr].message);
          }
        });
      };

      // File change possible
      $scope.uploadFile = new FileUploader();
      $scope.uploadFile.url = `${resourceURL}/upload`;
      $scope.uploadFile.alias = 'head_image';
      $scope.uploadFile.autoUpload = true;
      $scope.uploadFile.headers = {
        'X-Auth-Token': xAuthToken,
      };

      $scope.uploadFile.onCompleteAll = (res) => {
        console.log(res);
        $.gritter.add({
          title: 'Image uploaded',
          text: 'Your image was updated!',
          sticky: false,
          time: 8000,
          class_name: 'my-sticky-class',
        });
        $state.reload();
      };

      // Get the current event status
      $http.get(resourceURL).success((response) => {
        $scope.event = response;
      }).catch(showError);

      // Get organizers
      /* $http.get(resourceURL + '/organizers').success(function (res) {
        $scope.event.organizers = res;
      }).catch(function(err) {
        showError(err);
      }); */

      // Get the rights this user has on this event
      $http.get(`${resourceURL}/rights`).success((res) => {
        $scope.permissions = res.can;
      }).catch(showError);
    }
  }

  function ApproveParticipantsController($scope, $http, $stateParams) {
    // Fetch applications to this event
    const fetchApplications = $http.get(`${apiUrl}single/${$stateParams.id}/participants`);

    // Get the event to fetch application fields
    $http.get(`${apiUrl}single/${$stateParams.id}`).success((event) => {
      $scope.event = event;
      fetchApplications.success((res) => {
        $scope.event.applications = res;
        console.log(res);
      });
    }).catch(showError);

    // Get the rights this user has on this event
    $http.get(`${apiUrl}single/${$stateParams.id}/rights`).success((res) => {
      $scope.permissions = res.can;
      console.log(res);
    }).catch(showError);

    // Depending on status, return right css class
    $scope.calcColor = (application) => {
      switch (application.application_status) {
        case 'accepted':
          return 'success';
        case 'rejected':
          return 'danger';
        default:
          return 'active';
      }
    };

    $scope.showModal = (application) => {
      // Loop through application fields and assign them to our model
      application.application.forEach((field) => {
        // Find the matching application_field to our users application field
        $scope.event.application_fields.some((item, index) => {
          if (field.field_id === item._id) {
            $scope.event.application_fields[index].answer = field.value;
            return true;
          }
          return false;
        });
      });

      $scope.application = application;
      $('#applicationModal').modal('show');
    };

    $scope.changeState = (application, newState) => {
      // Store the change
      $http.put(`${apiUrl}single/${$stateParams.id}/participants/status/${application.id}`, { application_status: newState }).success(() => {
        $scope.event.applications.some((item, index) => {
          if (item.id === application.id) {
            $scope.event.applications[index].application_status = newState;
            return true;
          }
          return false;
        });
        $('#applicationModal').modal('hide');
      }).catch(showError);
    };
  }

  function ApproveEventsController($scope, $http) {
    $http.get(`${apiUrl}mine/approvable`).success((response) => {
      $scope.events = response;

      $scope.events.forEach((event) => {
        event.status = event.lifecycle.status.find(s => s._id === event.status);

        event.futureStatuses = event.lifecycle.status.filter((status) => {
          return event.lifecycle.transitions.some((transition) => {
            return transition.from === event.status._id && transition.to === status._id;
          });
        });
      });
    }).catch(showError);

    $scope.changeState = (event, newStatus) => {
      $http.put(`${apiUrl}single/${event.id}/status`, { status: newStatus }).success(() => {
        $.gritter.add({
          title: 'Event status updated.',
          text: `${event.name}'s status has been changed from '${event.status.name}'' to '${event.futureStatus.name}'`,
          sticky: false,
          time: 8000,
          class_name: 'my-sticky-class',
        });

        $scope.events.splice($scope.events.find(item => item.id === event.id), 1);
      }).catch(showError);
    };
  }

  function BoardviewController($scope, $http) {
    $http.get(`${apiUrl}boardview`).success((response) => {
      $scope.events = response.events;
    }).catch(showError);

    $scope.submitComment = (event, application) => {
      const data = { board_comment: application.board_comment };
      $http.put(`${apiUrl}single/${event.id}/participants/comment/${application._id}`, data).success(() => {
        $.gritter.add({
          title: 'Comment saved',
          text: 'Your comment has been saved',
          sticky: false,
          time: 8000,
          class_name: 'my-sticky-class',
        });
        application.clean = true;
      }).catch((err) => {
        showError(err);
        application.clean = false;
      });
    };
  }

  function ServiceAdminController($scope, $http) {
    const start1 = new Date().getTime();
    $http.get(`${apiUrl}getUser`).success((response) => {
      $scope.user = response;
      $scope.roundtrip1 = (new Date().getTime()) - start1;
    }).catch(showError);

    const start2 = new Date().getTime();
    $http.get(`${apiUrl}status`).success((response) => {
      $scope.status = response;
      $scope.roundtrip2 = (new Date().getTime()) - start2;
    }).catch(showError);

    $http.get(`${apiUrl}/boardview`).success((res) => {
      console.log(res);
    }).catch(showError);

    $http.get('/api/getRoles').success((allRoles) => {
      $scope.roles = [];
      allRoles.rows.forEach((item) => {
        $scope.roles.push({
          id: item.cell[0],
          name: item.cell[1],
        });
      });
    }).catch(showError);

    $http.get(`${apiUrl}lifecycle`).success((response) => {
      $scope.eventTypes = response.data;
    }).catch(showError);

    $http.get(apiUrl + 'lifecycle/pseudo').success((res) => {
      $scope.specialRolesData = res.data;
    }).catch(showError);

    const randomDate = (start, end) =>
      new Date(start.getTime() + (Math.random() * (end.getTime() - start.getTime())));


    $scope.fakeData = () => {
      const total = 10;
      let counter = total;

      const eventAddHandler = () => {
        counter--;
        if (counter === 0) {
          $.gritter.add({
            title: `Added ${total} random events`,
            text: 'Check out "my events" to see them',
            sticky: false,
            time: '3600',
            class_name: 'my-sticky-class',
          });
        }
      };

      const titles = ['Hackathon', 'Visit museum', 'Sightseeing', 'LGBTI Demonstration', 'Adventure time: return of the rabbits', 'Jamsession', `Develop Yourself ${Math.floor(Math.random() * 20)}`, 'The Mystery of Transylvanian (K)nights'];

      const descriptions = ['Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quae cum dixisset paulumque institisset, Quid est? Omnes enim iucundum motum, quo sensus hilaretur. Duo Reges: constructio interrete. Qua ex cognitione facilior facta est investigatio rerum occultissimarum.',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Utinam quidem dicerent alium alio beatiorem! Iam ruinas videres. Si stante, hoc natura videlicet vult, salvam esse se, quod concedimus; Iam id ipsum absurdum, maximum malum neglegi. Quorum sine causa fieri nihil putandum est. Non potes, nisi retexueris illa. Duo Reges: constructio interrete. Mihi enim satis est, ipsis non satis. Si enim ad populum me vocas, eum. Tibi hoc incredibile, quod beatissimum. Quod si ita se habeat, non possit beatam praestare vitam sapientia.',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. An potest, inquit ille, quicquam esse suavius quam nihil dolere? Qualis ista philosophia est, quae non interitum afferat pravitatis, sed sit contenta mediocritate vitiorum? Ergo id est convenienter naturae vivere, a natura discedere. Qua tu etiam inprudens utebare non numquam. Inde sermone vario sex illa a Dipylo stadia confecimus. ',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tum Quintus: Est plane, Piso, ut dicis, inquit. Nonne igitur tibi videntur, inquit, mala? Mihi enim erit isdem istis fortasse iam utendum. Et ille ridens: Video, inquit, quid agas; Duo Reges: constructio interrete. Paulum, cum regem Persem captum adduceret, eodem flumine invectio? Quo plebiscito decreta a senatu est consuli quaestio Cn. Videamus animi partes, quarum est conspectus illustrior; Mihi enim satis est, ipsis non satis. Satis est ad hoc responsum. Nondum autem explanatum satis, erat, quid maxime natura vellet.'];

      const lifecycles = $scope.eventTypes.map(e => e.name);

      for (let i = 0; i < total; i++) {
        const title = titles[Math.floor(Math.random() * titles.length)];
        const start = randomDate(
          new Date(), new Date(new Date().setFullYear(new Date().getFullYear() + 3)));
        const end = new Date(start.getTime() + (Math.random() * 14 * 24 * 60 * 60 * 1000));
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const eventType = lifecycles[Math.floor(Math.random() * lifecycles.length)];

        const event = {
          name: title,
          starts: start,
          ends: end,
          description,
          type: eventType,
        };

        $http.post(apiUrl, event).success(eventAddHandler)
        .catch((err) => {
          console.log(err);
          showError(err);
        });
      }
    };

    $scope.addNewStatus = (eventType) => {
      eventType.defaultLifecycle.status.push({
        name: 'Default name',
        visibility: {
          users: [],
          roles: [],
          bodies: [],
          special: ['Public'],
        },
      });
    };

    $scope.addNewTransition = (eventType) => {
      eventType.defaultLifecycle.transitions.push({
        from: '',
        to: '',
        allowedFor: {
          users: [],
          roles: [],
          bodies: [],
          special: [],
        },
      });
    };

    $scope.addNewEventType = () => {
      $scope.eventTypes.push({
        name: 'Default event type',
        defaultLifecycle: {
          status: [],
          transitions: [],
          initialStatus: null,
        },
      });
    };

    $scope.updateLifecycle = (eventType) => {
      // Create an object for sending to server...
      // TODO: Validating new object
      const newLifecycle = {
        eventType: eventType.name,
        status: JSON.parse(JSON.stringify(eventType.defaultLifecycle.status)),
        transitions: JSON.parse(JSON.stringify(eventType.defaultLifecycle.transitions)),
        initialStatus: eventType.defaultLifecycle.initialStatus,
      };

      // ... aaaand sending it.
      $http.post(`${apiUrl}lifecycle`, newLifecycle).success(() => {
        $.gritter.add({
          title: 'Lifecycle updated.',
          text: `The default lifecycle for the event type '${eventType.name}' is successfully updated.`,
          sticky: false,
          time: '3600',
          class_name: 'my-sticky-class',
        });
      }).catch(showError);
    };

    $scope.deleteLifecycle = (eventType) => {
      $http.delete(`${apiUrl}lifecycle/${eventType.name}`).success(() => {
        $.gritter.add({
          title: 'Lifecycle updated.',
          text: `The lifecycle for the event type '${eventType.name}' was successfully deleted.`,
          sticky: false,
          time: '3600',
          class_name: 'my-sticky-class',
        });

        $scope.eventTypes.splice($scope.eventTypes.indexOf(eventType), 1);
      }).catch(showError);
    };

    $scope.clearInput = (id) => {
      if (!id) {
        $scope.$broadcast('angucomplete-alt:clearInput');
      } else {
        $scope.$broadcast('angucomplete-alt:clearInput', id);
      }
    };

    $scope.showModal = (objectToBind, description) => {
      $scope.access = JSON.parse(JSON.stringify(objectToBind));
      $scope.access.description = description;
      $scope.access.save = () => {
        // Clear all inputs upon save
        $scope.clearInput();
        // Not sure if this is necessary
        objectToBind.users = $scope.access.users;
        objectToBind.roles = $scope.access.roles;
        objectToBind.special = $scope.access.special;
        objectToBind.bodies = $scope.access.bodies;
        $('#accessModal').modal('hide');
      };
      $('#accessModal').modal('show');
    };

    // General callback for calling the API for data
    // Returns a promise for angucomplete-alt that is racing against the timeout,
    // returning the data from the called url
    var fetchData = (url, query, timeout) => {

      // Copied from the angular tutorial on how to add transformations
      function appendTransform(defaults, transform) {
        // We can't guarantee that the default transformation is an array
        defaults = angular.isArray(defaults) ? defaults : [defaults];

        // Append the new transformation to the defaults
        return defaults.concat(transform);
      }

      return $http({
        url: url + `?limit=20&name=${query}`,
        method: 'GET',
        transformResponse: appendTransform($http.defaults.transformResponse, function (res) {
          var data = [];
          if (res === null)
            return data;
          res.rows.forEach((item) => {
            data.push({
              foreign_id: item.cell[0],
              name: item.cell[1],
            });
          });
          return data;
        }),
        timeout: timeout,
      });
    };

    $scope.fetchUserData = (query, timeout) => {
      return fetchData(`/api/getUsers`, query, timeout);
    };

    $scope.fetchBodyData = (query, timeout) => {
      return fetchData(`/api/getAntennae`, query, timeout);
    };

    $scope.fetchRoleData = (query, timeout) => {
      return fetchData(`/api/getRoles`, query, timeout);
    };
  }

  angular
    .module('app.eventadmin', ['ui.bootstrap.datetimepicker', 'bootstrap3-typeahead'])
    .config(config)
    .controller('DashboardController', DashboardController)
    .controller('NewController', NewController)
    .controller('ApproveParticipantsController', ApproveParticipantsController)
    .controller('ApproveEventsController', ApproveEventsController)
    .controller('BoardviewController', BoardviewController)
    .controller('ServiceAdminController', ServiceAdminController)
    .directive('mwConfirmClick', [
      () => ({
        priority: -1,
        restrict: 'A',
        scope: { confirmFunction: '&mwConfirmClick' },
        link: (scope, element, attrs) => {
          element.bind('click', () => {
          // message defaults to "Are you sure?"
            const message = attrs.mwConfirmClickMessage ? attrs.mwConfirmClickMessage : 'Are you sure?';
          // confirm() requires jQuery
            if (confirm(message)) {
              scope.confirmFunction();
            }
          });
        },
      }),
    ]);
})();

