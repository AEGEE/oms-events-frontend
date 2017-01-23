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

    let ticketCount = 0;
    $scope.fetchNames = (query) => {
      ticketCount++;
      const myticket = ticketCount;
      $http.get(`/api/getUsers?limit=10&name=${query}`).success((res) => {
        // Do ticket synchronization if one request passes the other one
        // This way we will only display the result of the last search
        if (ticketCount === myticket) {
          $scope.neworganizer.proposals = [];
          res.rows.forEach((item) => {
            $scope.neworganizer.proposals.push({
              foreign_id: item.cell[0],
              name: item.cell[1],
              antenna_name: item.cell[5],
            });
          });
          console.log($scope.neworganizer.proposals);
        }
      }).catch(showError);
    };

    $scope.addOrganizer = (organizer) => {
      $scope.event.organizers.push(organizer);
      $scope.neworganizer.query = '';
    };

    $scope.removeOrganizer = (index) => {
      if ($scope.event.organizers && $scope.event.organizers.length > index) {
        $scope.event.organizers.splice(index, 1);
      }
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
      $scope.deleteEvent = () => {
        $http.delete(resourceURL).success(() => {
          $.gritter.add({
            title: 'Event deleted',
            text: 'The event was deleted. If you wish to undo that, contact an admin.',
            sticky: false,
            time: 8000,
            class_name: 'my-sticky-class',
          });
          $state.go('app.events');
        }).catch(showError);
      };

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
      $scope.uploadFile.url = `${resourceURL}/upload`
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
    }).catch(showError);

    $scope.changeState = (event, newstate) => {
      $http.put(`${apiUrl}single/${event.id}/status`, { status: newstate }).success(() => {
        $scope.events.splice($scope.events.find(item => item.id === event.id));
        if (newstate === 'approved') {
          $.gritter.add({
            title: 'Event approved',
            text: `${event.name} has been approved and is now visible on event listing`,
            sticky: false,
            time: 8000,
            class_name: 'my-sticky-class',
          });
        } else {
          $.gritter.add({
            title: 'Event reset',
            text: `${event.name} has been sent to draft again, the organizers will edit it`,
            sticky: false,
            time: 8000,
            class_name: 'my-sticky-class',
          });
        }
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

      $http.get(`${apiUrl}roles`).success((setRoles) => {
        if (setRoles.su_admin) {
          $scope.su_admin = $scope.roles.find(item => item.id === setRoles.su_admin);
        }
        if (setRoles.statutory_admin) {
          $scope.statutory_admin = $scope.roles.find(item => item.id === setRoles.statutory_admin);
        }
        if (setRoles.non_statutory_admin) {
          $scope.non_statutory_admin = $scope.roles.find(
            item => item.id === setRoles.non_statutory_admin);
        }
        if (setRoles.super_admin) {
          $scope.super_admin = $scope.roles.find(item => item.id === setRoles.super_admin);
        }
      });
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

      for (let i = 0; i < total; i++) {
        const titles = ['Hackathon', 'Visit museum', 'Sightseeing', 'LGBTI Demonstration', 'Adventure time: return of the rabbits', 'Jamsession', `Develop Yourself ${Math.floor(Math.random() * 20)}`, 'The Mystery of Transylvanian (K)nights'];
        const title = titles[Math.floor(Math.random() * titles.length)];
        const start = randomDate(
          new Date(), new Date(new Date().setFullYear(new Date().getFullYear() + 3)));
        const end = new Date(start.getTime() + (Math.random() * 14 * 24 * 60 * 60 * 1000));
        const descriptions = ['Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quae cum dixisset paulumque institisset, Quid est? Omnes enim iucundum motum, quo sensus hilaretur. Duo Reges: constructio interrete. Qua ex cognitione facilior facta est investigatio rerum occultissimarum.',
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Utinam quidem dicerent alium alio beatiorem! Iam ruinas videres. Si stante, hoc natura videlicet vult, salvam esse se, quod concedimus; Iam id ipsum absurdum, maximum malum neglegi. Quorum sine causa fieri nihil putandum est. Non potes, nisi retexueris illa. Duo Reges: constructio interrete. Mihi enim satis est, ipsis non satis. Si enim ad populum me vocas, eum. Tibi hoc incredibile, quod beatissimum. Quod si ita se habeat, non possit beatam praestare vitam sapientia.',
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. An potest, inquit ille, quicquam esse suavius quam nihil dolere? Qualis ista philosophia est, quae non interitum afferat pravitatis, sed sit contenta mediocritate vitiorum? Ergo id est convenienter naturae vivere, a natura discedere. Qua tu etiam inprudens utebare non numquam. Inde sermone vario sex illa a Dipylo stadia confecimus. ',
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tum Quintus: Est plane, Piso, ut dicis, inquit. Nonne igitur tibi videntur, inquit, mala? Mihi enim erit isdem istis fortasse iam utendum. Et ille ridens: Video, inquit, quid agas; Duo Reges: constructio interrete. Paulum, cum regem Persem captum adduceret, eodem flumine invectio? Quo plebiscito decreta a senatu est consuli quaestio Cn. Videamus animi partes, quarum est conspectus illustrior; Mihi enim satis est, ipsis non satis. Satis est ad hoc responsum. Nondum autem explanatum satis, erat, quid maxime natura vellet.'];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const event = {
          name: title,
          starts: start,
          ends: end,
          description,
        };

        $http.post(apiUrl, event).success(eventAddHandler)
        .catch((err) => {
          console.log(err);
        });
      }
    };

    $scope.submitForm = () => {
      const data = {
        roles: {
          su_admin: '',
          statutory_admin: '',
          non_statutory_admin: '',
          super_admin: '',
        },
      };

      if ($scope.su_admin) {
        data.roles.su_admin = $scope.su_admin.id;
      }
      if ($scope.statutory_admin) {
        data.roles.statutory_admin = $scope.statutory_admin.id;
      }
      if ($scope.non_statutory_admin) {
        data.roles.non_statutory_admin = $scope.non_statutory_admin.id;
      }
      if ($scope.super_admin) {
        data.roles.super_admin = $scope.super_admin.id;
      }


      $http.put(`${apiUrl}roles`, data).success(() => {
        $.gritter.add({
          title: 'Roles saved',
          text: 'Your changes to the roles were successfully saved',
          sticky: false,
          time: 8000,
          class_name: 'my-sticky-class',
        });
      }).catch(showError);
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
