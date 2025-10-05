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
        <div class="row">
          <div class="col-lg-12">
            <h1 class="h3 mb-4 text-gray-800"><?php echo $title; ?></h1>
            
            <?php if($this->session->flashdata('message')): ?>
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
              <?php echo $this->session->flashdata('message'); ?>
              <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <?php endif; ?>

            <!-- Breadcrumb -->
            <nav aria-label="breadcrumb">
              <ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="<?php echo base_url();?>providers">Providers</a></li>
                <li class="breadcrumb-item active" aria-current="page">Delete Provider</li>
              </ol>
            </nav>

            <!-- Provider Details Card -->
            <div class="card shadow mb-4">
              <div class="card-header py-3 bg-danger text-white">
                <h6 class="m-0 font-weight-bold">Confirm Provider Deletion</h6>
              </div>
              <div class="card-body">
                <div class="alert alert-warning" role="alert">
                  <i class="fa fa-exclamation-triangle"></i>
                  <strong>Warning!</strong> You are about to delete this provider. This action cannot be undone.
                </div>

                <div class="row">
                  <div class="col-md-6">
                    <table class="table table-borderless">
                      <tr>
                        <td><strong>Provider Name:</strong></td>
                        <td><?php echo $fields->name; ?></td>
                      </tr>
                      <tr>
                        <td><strong>Description:</strong></td>
                        <td><?php echo $fields->description ?: 'N/A'; ?></td>
                      </tr>
                      <tr>
                        <td><strong>Currency:</strong></td>
                        <td>
                          <span class="badge badge-secondary"><?php echo $fields->currency; ?></span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Status:</strong></td>
                        <td>
                          <span class="badge badge-<?php echo ($fields->status == 'active') ? 'success' : 'secondary'; ?>">
                            <?php echo ucfirst($fields->status); ?>
                          </span>
                        </td>
                      </tr>
                    </table>
                  </div>
                  <div class="col-md-6">
                    <table class="table table-borderless">
                      <tr>
                        <td><strong>Billing Increment:</strong></td>
                        <td><?php echo $fields->billing_increment; ?> seconds</td>
                      </tr>
                      <tr>
                        <td><strong>Minimum Duration:</strong></td>
                        <td><?php echo $fields->minimum_duration; ?> seconds</td>
                      </tr>
                      <tr>
                        <td><strong>Created:</strong></td>
                        <td><?php echo date('Y-m-d H:i:s', strtotime($fields->created_at)); ?></td>
                      </tr>
                      <tr>
                        <td><strong>Last Updated:</strong></td>
                        <td><?php echo $fields->updated_at ? date('Y-m-d H:i:s', strtotime($fields->updated_at)) : 'Never'; ?></td>
                      </tr>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            

            <!-- Action Buttons -->
            <div class="card shadow mb-4">
              <div class="card-body">
                <?php if($rate_cards_count == 0): ?>
                <form method="POST" action="<?php echo base_url();?>providers/delete/<?php echo $fields->id; ?>" onsubmit="return confirm('Are you absolutely sure you want to delete this provider? This action cannot be undone!');">
                  <input type="hidden" name="id" value="<?php echo $fields->id; ?>">
                  <button type="submit" class="btn btn-danger">
                    <i class="fa fa-trash"></i> Yes, Delete Provider
                  </button>
                  <a href="<?php echo base_url();?>providers" class="btn btn-secondary">
                    <i class="fa fa-times"></i> Cancel
                  </a>
                  <a href="<?php echo base_url();?>providers/view/<?php echo $fields->id; ?>" class="btn btn-info">
                    <i class="fa fa-eye"></i> View Details
                  </a>
                </form>
                <?php else: ?>
                <div class="alert alert-info" role="alert">
                  <strong>Next Steps:</strong>
                  <ol class="mb-0 mt-2">
                    <li>Cannot Delete rate card as it is associated rate cards</li>
					<li>Delete or reassign all rate cards associated with this provider</li>
                    <li>Return to this page to complete the deletion</li>
                  </ol>
                </div>
                <a href="<?php echo base_url();?>rate_cards?provider_id=<?php echo $fields->id; ?>" class="btn btn-warning">
                  <i class="fa fa-credit-card"></i> Manage Rate Cards
                </a>
                <a href="<?php echo base_url();?>providers" class="btn btn-secondary">
                  <i class="fa fa-arrow-left"></i> Back to Providers
                </a>
                <a href="<?php echo base_url();?>providers/view/<?php echo $fields->id; ?>" class="btn btn-info">
                  <i class="fa fa-eye"></i> View Details
                </a>
                <?php endif; ?>
              </div>
            </div>

          </div>
        </div>
      </div>
      <!-- /.container-fluid -->

    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>

  <script>
    $(document).ready(function(){
      // Additional confirmation for delete
      $('form[action*="delete"]').on('submit', function(e) {
        if (!confirm('This will permanently delete the provider "<?php echo addslashes($fields->name); ?>". Are you sure?')) {
          e.preventDefault();
          return false;
        }
      });
    });
  </script>
</body>

</html>