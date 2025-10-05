<?php $this->load->view('templates/header'); ?>

<body>

  <div class="d-flex" id="wrapper">

    <!-- Sidebar -->
    <?php $this->load->view('templates/navbar'); ?>
    <!-- /#sidebar-wrapper -->

    <!-- Page Content -->
    <div id="page-content-wrapper">
      <?php $this->load->view('templates/top_nav'); ?>
      
      <div class="container-fluid">
        <h3 class="mt-4">Manage Agents - <?php echo $user->first_name . ' ' . $user->last_name; ?></h3>
        <nav aria-label="breadcrumb">
          <ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="<?php echo base_url(); ?>clients">Clients</a></li>
            <li class="breadcrumb-item"><a href="<?php echo base_url(); ?>clients/edit/<?php echo $user->id; ?>">Edit User</a></li>
            <li class="breadcrumb-item active">Manage Agents</li>
          </ol>
        </nav>
        
        <h6 class="mt-4 alert-message"><?php echo $this->session->flashdata('message');?></h6>
        
        <div class="row">
          <!-- Associated Agents -->
          <div class="col-md-6">
            <div class="card">
              <div class="card-header bg-success text-white">
                <h5><i class="fas fa-users"></i> Associated Agents (<?php echo count($associated_agents); ?>)</h5>
              </div>
              <div class="card-body">
                <div id="associated-agents-list">
                  <?php if(empty($associated_agents)): ?>
                    <div class="alert alert-info">
                      <i class="fas fa-info-circle"></i> No agents associated with this user yet.
                    </div>
                  <?php else: ?>
                    <div class="table-responsive">
                      <table class="table table-sm">
                        <thead>
                          <tr>
                            <th>Agent Name</th>
                            <th>Extension</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          <?php foreach($associated_agents as $agent): ?>
                          <tr id="associated-agent-<?php echo $agent->id; ?>">
                            <td><strong><?php echo $agent->name; ?></strong></td>
                            <td><?php echo $agent->defaultuser ?: $agent->username; ?></td>
                            <td><span class="badge badge-primary"><?php echo ucfirst($agent->category); ?></span></td>
                            <td>
                              <?php if($agent->status): ?>
                                <span class="badge badge-success">Active</span>
                              <?php else: ?>
                                <span class="badge badge-danger">Inactive</span>
                              <?php endif; ?>
                            </td>
                            <td>
                              <button class="btn btn-danger btn-sm remove-agent" 
                                      data-agent-id="<?php echo $agent->id; ?>"
                                      data-agent-name="<?php echo $agent->name; ?>">
                                <i class="fas fa-unlink"></i> Remove
                              </button>
                            </td>
                          </tr>
                          <?php endforeach; ?>
                        </tbody>
                      </table>
                    </div>
                  <?php endif; ?>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Available Agents -->
          <div class="col-md-6">
            <div class="card">
              <div class="card-header bg-primary text-white">
                <h5><i class="fas fa-plus-circle"></i> Available Agents (<?php echo count($available_agents); ?>)</h5>
              </div>
              <div class="card-body">
                <?php if(empty($available_agents)): ?>
                  <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i> No unassigned agents available.
                  </div>
                <?php else: ?>
                  <div class="table-responsive">
                    <table class="table table-sm">
                      <thead>
                        <tr>
                          <th>Agent Name</th>
                          <th>Extension</th>
                          <th>Category</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <?php foreach($available_agents as $agent): ?>
                        <tr id="available-agent-<?php echo $agent->id; ?>">
                          <td><strong><?php echo $agent->name; ?></strong></td>
                          <td><?php echo $agent->defaultuser ?: $agent->username; ?></td>
                          <td><span class="badge badge-secondary"><?php echo ucfirst($agent->category); ?></span></td>
                          <td>
                            <button class="btn btn-success btn-sm associate-agent" 
                                    data-agent-id="<?php echo $agent->id; ?>"
                                    data-agent-name="<?php echo $agent->name; ?>">
                              <i class="fas fa-link"></i> Associate
                            </button>
                          </td>
                        </tr>
                        <?php endforeach; ?>
                      </tbody>
                    </table>
                  </div>
                <?php endif; ?>
              </div>
            </div>
          </div>
        </div>
        
        <hr>
        <div class="row">
          <div class="col-md-12">
            <a href="<?php echo base_url(); ?>clients/edit/<?php echo $user->id; ?>" class="btn btn-secondary">
              <i class="fas fa-arrow-left"></i> Back to Edit User
            </a>
            <a href="<?php echo base_url(); ?>clients" class="btn btn-primary">
              <i class="fas fa-users"></i> Back to Users List
            </a>
          </div>
        </div>
        
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
  $(document).ready(function(){
    
    // Associate agent with user
    $('.associate-agent').click(function(){

      var agentId = $(this).data('agent-id');
      var agentName = $(this).data('agent-name');
      var userId = <?php echo $user->id; ?>;
      
      if(confirm('Associate agent "' + agentName + '" with this user?')){
        $.ajax({
          url: '<?php echo base_url(); ?>clients/associate_agent',
          type: 'POST',
          data: {
            user_id: userId,
            agent_id: agentId
          },
          dataType: 'json',
          success: function(response){
            if(response.success){
              $('.alert-message').html('<div class="alert alert-success">' + response.message + '</div>');
              setTimeout(function(){
                location.reload();
              }, 1000);
            } else {
              $('.alert-message').html('<div class="alert alert-danger">' + response.message + '</div>');
            }
          },
          error: function(){
            $('.alert-message').html('<div class="alert alert-danger">Error associating agent</div>');
          }
        });
      }
    });
    
    // Remove agent association
    $('.remove-agent').click(function(){
      var agentId = $(this).data('agent-id');
      var agentName = $(this).data('agent-name');
      
      if(confirm('Remove association of agent "' + agentName + '" from this user?')){
        $.ajax({
          url: '<?php echo base_url(); ?>clients/remove_agent_association',
          type: 'POST',
          data: {
            agent_id: agentId
          },
          dataType: 'json',
          success: function(response){
            if(response.success){
              $('.alert-message').html('<div class="alert alert-success">' + response.message + '</div>');
              setTimeout(function(){
                location.reload();
              }, 1000);
            } else {
              $('.alert-message').html('<div class="alert alert-danger">' + response.message + '</div>');
            }
          },
          error: function(){
            $('.alert-message').html('<div class="alert alert-danger">Error removing association</div>');
          }
        });
      }
    });
    
  });
  </script>

</body>
</html>